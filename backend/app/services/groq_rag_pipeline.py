"""
Multi-Agent RAG Pipeline using Groq and LangGraph

This module orchestrates a unified agent for generating hyper-local
business feasibility reports using Context Retrieval and a single highly
optimized LLM call.

STRICT CONTRACT:
The LLM ONLY explains the deterministic financial snapshot.
It NEVER recalculates financial numbers and NEVER invents market demand or risk scores.
"""

import os
import json
os.environ["TF_USE_LEGACY_KERAS"] = "1"

from typing import TypedDict, Annotated, Sequence, Optional, Dict, Any, List
from operator import add

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings

class UnifiedReport(BaseModel):
    summary: str
    deterministic_findings_explained: str
    caveats: list[str]
    questions_to_validate: list[str]
    suggested_next_steps: list[str]

class AgentState(TypedDict):
    business_id: str
    business_category: str
    location: str
    capital: Optional[float]
    deterministic_snapshot: Dict[str, Any]
    market_data_status: str
    evidence_count: int
    
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
        snap = state.get("deterministic_snapshot") or {}
        market_status = state.get("market_data_status", "NO_VERIFIED_DATA")
        evidence_count = state.get("evidence_count", 0)

        cap = state.get("capital")
        if cap is None:
            capital_display = "Not provided"
        elif cap == 0:
            capital_display = "₹0"
        else:
            capital_display = f"₹{int(cap)}" if isinstance(cap, (int, float)) and float(cap).is_integer() else f"₹{cap}"

        retrieved_context = f"""
[BUSINESS PROFILE]
- Business Category: {state['business_category']}
- Location: {state['location']}
- Margin Capital: {capital_display}

[DETERMINISTIC FINANCIAL SNAPSHOT]
- Monthly Revenue: {snap.get('monthly_revenue', 'Missing')}
- Monthly Variable Cost: {snap.get('monthly_variable_cost', 'Missing')}
- Monthly Fixed Cost: {snap.get('monthly_fixed_cost', 'Missing')}
- Monthly Operating Surplus: {snap.get('monthly_operating_surplus', 'Missing')}
- Unit Contribution Margin: {snap.get('unit_contribution_margin', 'Missing')}
- Break-Even Units: {snap.get('break_even_units', 'Missing')} (Status: {snap.get('break_even_status', 'Missing')})
- Candidate EMI: {snap.get('candidate_emi', 'Missing')}
- Business DSCR: {snap.get('business_dscr', 'Missing')}
- Maximum Affordable EMI: {snap.get('maximum_affordable_emi', 'Missing')}
- Affordable Loan Amount: {snap.get('affordable_loan_amount', 'Missing')}
- Recommended Loan Amount: {snap.get('recommended_loan_amount', 'Missing')}
- Business Affordability Status: {snap.get('business_affordability_status', 'Missing')}
- Household Affordability Status: {snap.get('household_affordability_status', 'Missing')}
- Overall Readiness: {snap.get('overall_readiness', 'Missing')}
- Missing Data Fields: {snap.get('missing_fields', [])}
- Stress Test Results: {json.dumps(snap.get('stress_results', []))}

[LOCAL MARKET DATA STATUS]
- Market Data Status: {market_status}
- Verified Market Evidence Count: {evidence_count}
- Note: When status is NO_VERIFIED_DATA, no on-ground evidence is available for local demand, pricing, or competitors. Emphasize field validation.
"""
        query = f"{state['business_category']} in {state['location']}"
        return {
            "retrieved_context": retrieved_context,
            "messages": [HumanMessage(content=f"Retrieved context for {query}")]
        }

    def _unified_agent(self, state: AgentState) -> dict:
        system_prompt = """You are an elite Micro-Finance and MSME Credit Risk Analyst operating as an explanatory intelligence for the 'Aarthika' platform.

Your ONLY task is to EXPLAIN the provided deterministic financial snapshot.
CRITICAL RULES:
1. NEVER recalculate or invent financial numbers. All financial metrics (revenue, surplus, break-even, DSCR, EMI) in the snapshot are fixed, authoritative, and deterministic.
2. DO NOT invent numeric risk scores, market demand levels ('HIGH', 'MEDIUM'), competitor counts, or GO/NO-GO investment decisions.
3. If Market Data Status is NO_VERIFIED_DATA, you MUST explicitly state that local demand, customer footfall, and competitors have no verified data and require on-ground field validation.
4. Your role is solely to explain findings, highlight caveats, ask questions to validate on-ground, and suggest practical next steps.

CRITICAL REQUIREMENT:
You must respond with ONLY a valid, minified JSON object matching the schema. Absolutely NO markdown formatting, NO backticks (```json), NO conversational text, and NO preamble."""

        cap = state.get("capital")
        if cap is None:
            capital_display = "Not provided"
        elif cap == 0:
            capital_display = "₹0"
        else:
            capital_display = f"₹{int(cap)}" if isinstance(cap, (int, float)) and float(cap).is_integer() else f"₹{cap}"

        human_prompt = """Explain the deterministic assessment for this business:

Business Category: {business_category}
Location: {location}
Available Capital: {capital}

Context & Deterministic Assessment:
{retrieved_context}
"""

        inputs = {
            "business_category": state["business_category"],
            "location": state["location"],
            "capital": capital_display,
            "retrieved_context": state["retrieved_context"]
        }

        schema_hint = json.dumps(UnifiedReport.model_json_schema())

        def _extract_and_validate(raw: str) -> UnifiedReport:
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("```", 2)[1]
                if text.startswith("json"):
                    text = text[4:]
            start, end = text.find("{"), text.rfind("}")
            if start == -1 or end == -1:
                raise ValueError(f"No JSON object in model output: {raw[:200]}")
            return UnifiedReport.model_validate_json(text[start:end + 1])

        json_llm = self.llm.bind(response_format={"type": "json_object"})
        schema_system = (
            system_prompt
            + "\n\nYou MUST respond with a raw JSON object that matches EXACTLY the schema below "
              "(use the exact snake_case field names, no aliases, no extra keys, no commentary):\n"
            + schema_hint
        )
        schema_messages = [
            SystemMessage(content=schema_system),
            HumanMessage(content=human_prompt.format(**inputs)),
        ]
        try:
            result = _extract_and_validate(
                json_llm.invoke(schema_messages).content
            )
        except Exception as first_err:
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
            "messages": [AIMessage(content=f"Report generated.")]
        }

    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(AgentState)
        workflow.add_node("retrieve", self._retrieve_context)
        workflow.add_node("unified_agent", self._unified_agent)
        
        workflow.set_entry_point("retrieve")
        workflow.add_edge("retrieve", "unified_agent")
        workflow.add_edge("unified_agent", END)
        return workflow.compile()

    async def generate_report(
        self,
        business_id: str,
        business_category: str,
        location: str,
        capital: Optional[float] = None,
        deterministic_snapshot: Dict[str, Any] | None = None,
        market_data_status: str = "NO_VERIFIED_DATA",
        evidence_count: int = 0,
    ) -> dict:
        initial_state = AgentState(
            business_id=business_id,
            business_category=business_category,
            location=location,
            capital=capital,
            deterministic_snapshot=deterministic_snapshot or {},
            market_data_status=market_data_status,
            evidence_count=evidence_count,
            retrieved_context="",
            report=None,
            messages=[]
        )
        final_state = await self.graph.ainvoke(initial_state)
        r = final_state["report"]
        
        return {
            "business_id": business_id,
            "final_recommendation": {
                "summary": r.summary,
                "deterministic_findings_explained": r.deterministic_findings_explained,
                "caveats": r.caveats,
                "questions_to_validate": r.questions_to_validate,
                "suggested_next_steps": r.suggested_next_steps
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
