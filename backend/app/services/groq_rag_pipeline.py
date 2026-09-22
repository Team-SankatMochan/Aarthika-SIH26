"""
Multi-Agent RAG Pipeline using Groq and LangGraph

This module orchestrates a unified agent for generating hyper-local
business feasibility reports using Context Retrieval and a single highly
optimized LLM call.
"""

import os
import json
os.environ["TF_USE_LEGACY_KERAS"] = "1"

from typing import TypedDict, Annotated, Sequence
from operator import add

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings

# Unified Pydantic Model for Structured Output
class MarketAnalysis(BaseModel):
    demand_level: str = Field(description="HIGH | MEDIUM | LOW")
    competitor_count: str
    market_trend_score: float
    swot_strengths: list[str]
    swot_weaknesses: list[str]
    swot_opportunities: list[str]
    swot_threats: list[str]

class RiskAssessment(BaseModel):
    market_risk: float
    financial_risk: float
    operational_risk: float
    overall_risk: float
    top_risks: list[str]
    mitigation_strategies: list[str]

class UnifiedReport(BaseModel):
    decision: str = Field(description="GO | MODIFY | DO_NOT_INVEST_YET")
    confidence: float
    rationale: str
    market_analysis: MarketAnalysis
    risk_assessment: RiskAssessment
    modifications: list[str]
    next_steps: list[str]
class AgentState(TypedDict):
    business_id: str
    business_category: str
    location: str
    capital: float
    
    retrieved_context: str
    report: UnifiedReport | None
    
    messages: Annotated[Sequence[BaseMessage], add]


class GroqRAGPipeline:
    def __init__(self):
        from langchain_groq import ChatGroq
        from langchain_community.embeddings import HuggingFaceEmbeddings
        self.llm = ChatGroq(
            model="openai/gpt-oss-120b",
            temperature=0.2,
            max_tokens=2500,
            groq_api_key=settings.GROQ_API_KEY,
        )
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        self.graph = self._build_graph()

    def _retrieve_context(self, state: AgentState) -> dict:
        query = f"{state['business_category']} business in {state['location']} with capital {state['capital']}"
        # Phase 2 P2: Direct raw HTTP provider fetch removed to prevent unverified bypass.
        # External provider context injection disabled until Phase 2 P3 Evidence-based RAG.
        capital_float = float(state['capital']) if state['capital'] else 0.0
        retrieved_context = f"""
[BUSINESS PROFILE & FINANCIAL ESTIMATES]
- Business Category: {state['business_category']}
- Location: {state['location']}
- Average startup cost: ₹{capital_float * 0.8:.0f} to ₹{capital_float * 1.2:.0f}
- Monthly revenue potential: ₹{capital_float * 0.15:.0f} to ₹{capital_float * 0.25:.0f}
"""
        return {
            "retrieved_context": retrieved_context,
            "messages": [HumanMessage(content=f"Retrieved context for {query}")]
        }

    def _unified_agent(self, state: AgentState) -> dict:
        system_prompt = """You are an elite Micro-Finance and MSME Credit Risk Analyst operating as the core intelligence for the 'Aarthika' platform.

Your task is to analyze the provided business profile, financial details, and market context to generate a comprehensive, highly structured risk assessment.

CRITICAL REQUIREMENT:
You must respond with ONLY a valid, minified JSON object. Absolutely NO markdown formatting, NO backticks (```json), NO conversational text, and NO preamble. Just the raw JSON.

The frontend relies on this exact JSON schema to render graphs, SWOT matrices, and Risk Gauges. Ensure all arrays contain short, punchy, dashboard-ready strings (under 10 words each) rather than long paragraphs, as these will be rendered inside UI cards and lists.
Ensure scores (floats) are accurately calculated based on logical risk principles."""

        human_prompt = """Assess risks for this business:

Business Type: {business_category}
Location: {location}
Available Capital: ₹{capital}

Market Context:
{retrieved_context}
"""

        inputs = {
            "business_category": state["business_category"],
            "location": state["location"],
            "capital": state["capital"],
            "retrieved_context": state["retrieved_context"]
        }

        # openai/gpt-oss-120b on Groq refuses the implicit function-call
        # wrapper that with_structured_output(function_calling) uses (Groq
        # returns 400 "Tool choice is required, but model did not call a
        # tool"), and its json_mode wrapper does NOT inject the UnifiedReport
        # schema into the prompt, so the model invents its own keys. The
        # schema therefore has to be embedded in the prompt text itself.
        schema_hint = json.dumps(UnifiedReport.model_json_schema())

        def _extract_and_validate(raw: str) -> UnifiedReport:
            # Strip any accidental markdown fences / whitespace around the JSON
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("```", 2)[1]
                if text.startswith("json"):
                    text = text[4:]
            start, end = text.find("{"), text.rfind("}")
            if start == -1 or end == -1:
                raise ValueError(f"No JSON object in model output: {raw[:200]}")
            return UnifiedReport.model_validate_json(text[start:end + 1])

        # Primary: JSON mode with the exact schema in the prompt.
        json_llm = self.llm.bind(response_format={"type": "json_object"})
        schema_system = (
            system_prompt
            + "\n\nYou MUST respond with a raw JSON object that matches EXACTLY the schema below "
              "(use the exact snake_case field names, no aliases, no extra keys, no commentary):\n"
            + schema_hint
        )
        # Plain messages (NOT a ChatPromptTemplate): the JSON schema contains
        # nested braces that the prompt template's f-string parser rejects.
        schema_messages = [
            SystemMessage(content=schema_system),
            HumanMessage(content=human_prompt.format(**inputs)),
        ]
        try:
            result = _extract_and_validate(
                json_llm.invoke(schema_messages).content
            )
        except Exception as first_err:
            # A single retry with a slightly higher temperature usually
            # recovers from a truncated / malformed first attempt.
            print(f"[pipeline] JSON-mode attempt failed ({first_err}); retrying once")
            from langchain_groq import ChatGroq
            warm_llm = ChatGroq(
                model=self.llm.model_name,
                temperature=0.4,
                max_tokens=2500,
                groq_api_key=settings.GROQ_API_KEY,
            ).bind(response_format={"type": "json_object"})
            result = _extract_and_validate(
                warm_llm.invoke(schema_messages).content
            )

        return {
            "report": result,
            "messages": [AIMessage(content=f"Report generated. Decision: {result.decision}")]
        }

    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(AgentState)
        workflow.add_node("retrieve", self._retrieve_context)
        workflow.add_node("unified_agent", self._unified_agent)
        
        workflow.set_entry_point("retrieve")
        workflow.add_edge("retrieve", "unified_agent")
        workflow.add_edge("unified_agent", END)
        return workflow.compile()

    async def generate_report(self, business_id: str, business_category: str, location: str, capital: float) -> dict:
        initial_state = AgentState(
            business_id=business_id,
            business_category=business_category,
            location=location,
            capital=capital,
            retrieved_context="",
            report=None,
            messages=[]
        )
        final_state = await self.graph.ainvoke(initial_state)
        r = final_state["report"]
        
        # Format it exactly as ai_reports.py expects
        return {
            "business_id": business_id,
            "market_analysis": r.market_analysis.dict(),
            "risk_assessment": r.risk_assessment.dict(),
            "final_recommendation": {
                "decision": r.decision,
                "rationale": r.rationale,
                "confidence": r.confidence,
                "modifications": r.modifications,
                "next_steps": r.next_steps
            },
            "metadata": {
                "retrieved_context": final_state["retrieved_context"],
                "agent_messages": [msg.content for msg in final_state["messages"]]
            }
        }

_pipeline_instance = None
def get_rag_pipeline() -> GroqRAGPipeline:
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = GroqRAGPipeline()
    return _pipeline_instance
