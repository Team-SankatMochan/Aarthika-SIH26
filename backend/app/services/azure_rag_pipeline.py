"""
Multi-Agent RAG Pipeline using Groq and LangGraph

This module orchestrates a multi-agent system for generating hyper-local
business feasibility reports using:
- Context Retrieval via pgvector semantic search
- Market Analyst Agent (SWOT, competitors, demand)
- Risk Actuary Agent (hidden risks, mitigation)
- Financial Validator Agent (cross-check numbers)
- Recommendation Agent (final GO/NO-GO decision)

Using Groq for ultra-fast inference (500+ tokens/sec) with Llama 3.2 models.
"""

import os
from typing import TypedDict, Annotated, Sequence
from operator import add

from langchain_groq import ChatGroq
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db


# Pydantic Models for Structured Output
class MarketAnalysis(BaseModel):
    """Market Analyst Agent Output"""
    swot_strengths: list[str] = Field(description="Top 3 strengths")
    swot_weaknesses: list[str] = Field(description="Top 3 weaknesses")
    swot_opportunities: list[str] = Field(description="Top 2 opportunities")
    swot_threats: list[str] = Field(description="Top 2 threats")
    demand_level: str = Field(description="HIGH, MEDIUM, or LOW")
    competitor_count: str = Field(description="Estimated competitor landscape")
    confidence: float = Field(description="Confidence score 0-1", ge=0, le=1)


class RiskAssessment(BaseModel):
    """Risk Actuary Agent Output"""
    market_risk: float = Field(description="Market risk score 0-1", ge=0, le=1)
    financial_risk: float = Field(description="Financial risk score 0-1", ge=0, le=1)
    operational_risk: float = Field(description="Operational risk score 0-1", ge=0, le=1)
    top_risks: list[str] = Field(description="Top 3 risk factors")
    mitigation_strategies: list[str] = Field(description="Recommended mitigations")
    safer_loan_amount: float = Field(description="Recommended safer loan amount")


class FinalRecommendation(BaseModel):
    """Final Recommendation Agent Output"""
    decision: str = Field(description="GO, MODIFY, or DO_NOT_INVEST_YET")
    rationale: str = Field(description="3-5 sentence explanation in simple Hindi/English")
    confidence: float = Field(description="Confidence level 0-1", ge=0, le=1)
    modifications: list[str] = Field(default=[], description="If MODIFY, list specific changes")
    next_steps: list[str] = Field(description="Actionable next steps for entrepreneur")


# State Definition
class AgentState(TypedDict):
    """State shared across all agents in the pipeline"""
    # Inputs
    business_id: str
    business_category: str
    location: str
    capital: float

    # Intermediate Results
    retrieved_context: str
    market_analysis: MarketAnalysis | None
    risk_assessment: RiskAssessment | None

    # Final Output
    final_recommendation: FinalRecommendation | None

    # Messages (for debugging)
    messages: Annotated[Sequence[BaseMessage], add]


class GroqRAGPipeline:
    """Multi-Agent RAG Pipeline using Groq (FREE & Fast)"""

    def __init__(self):
        # Initialize Groq Chat Model (Using available 2026 model)
        self.llm = ChatGroq(
            model="openai/gpt-oss-120b",  # Highly capable model available on Groq
            temperature=0.2,
            max_tokens=2000,
            groq_api_key=os.environ.get("GROQ_API_KEY"),
        )

        # Initialize HuggingFace Embeddings (runs locally, free)
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )

        # Build the LangGraph workflow
        self.graph = self._build_graph()

    def _retrieve_context(self, state: AgentState) -> dict:
        """
        Context Retriever Agent
        Uses pgvector cosine similarity to find relevant market data
        """
        query = f"{state['business_category']} business in {state['location']} with capital {state['capital']}"

        # Generate query embedding
        query_vector = self.embeddings.embed_query(query)

        # TODO: Query pgvector database
        # For now, return mock context - replace with actual pgvector query
        try:
            db: Session = next(get_db())
            # Placeholder - implement actual pgvector query
            mock_context = f"""
Market data for {state['business_category']} in {state['location']}:
- Average startup cost: ₹{state['capital'] * 0.8:.0f} to ₹{state['capital'] * 1.2:.0f}
- Monthly revenue potential: ₹{state['capital'] * 0.15:.0f} to ₹{state['capital'] * 0.25:.0f}
- Competition level: Medium to High
- Local demand: Seasonal peaks during festivals
- Success rate: 65% survive first 2 years
            """
            retrieved_context = mock_context
        except Exception as e:
            retrieved_context = f"Limited market data available. Error: {str(e)}"

        return {
            "retrieved_context": retrieved_context,
            "messages": [HumanMessage(content=f"Retrieved context for {query}")]
        }

    def _market_analyst_agent(self, state: AgentState) -> dict:
        """
        Market Analyst Agent
        Performs SWOT analysis, competitor analysis, and demand estimation
        """
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a Market Analyst specializing in rural Indian businesses.
Analyze the market data and provide a comprehensive SWOT analysis."""),
            ("human", """Analyze this business proposal:

Business Type: {business_category}
Location: {location}
Available Capital: ₹{capital}

Market Context:
{retrieved_context}

Provide:
1. SWOT Analysis (top 3 strengths, weaknesses, 2 opportunities, 2 threats)
2. Demand level estimation (HIGH/MEDIUM/LOW)
3. Competitor landscape assessment
4. Confidence score (0-1)

Focus on hyper-local factors specific to {location}.""")
        ])

        chain = prompt | self.llm.with_structured_output(MarketAnalysis)
        result = chain.invoke({
            "business_category": state["business_category"],
            "location": state["location"],
            "capital": state["capital"],
            "retrieved_context": state["retrieved_context"]
        })

        return {
            "market_analysis": result,
            "messages": [AIMessage(content=f"Market analysis completed. Demand: {result.demand_level}")]
        }

    def _risk_actuary_agent(self, state: AgentState) -> dict:
        """
        Risk Actuary Agent
        Identifies hidden risks and provides mitigation strategies
        """
        market_summary = f"""
SWOT: Strengths: {', '.join(state['market_analysis'].swot_strengths)}
Weaknesses: {', '.join(state['market_analysis'].swot_weaknesses)}
Demand: {state['market_analysis'].demand_level}
"""

        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a Risk Actuary specializing in micro-enterprise loans.
Identify risks that pure mathematical models might miss."""),
            ("human", """Assess risks for this business:

Business: {business_category}
Location: {location}
Capital: ₹{capital}

Market Analyst's Report:
{market_summary}

Provide:
1. Market risk score (0-1)
2. Financial risk score (0-1)
3. Operational risk score (0-1)
4. Top 3 specific risks
5. Mitigation strategies
6. Safer recommended loan amount (should be <= {capital} * 10)

Risk scoring:
- 0-0.3: Low risk
- 0.3-0.7: Medium risk
- 0.7-1.0: High risk""")
        ])

        chain = prompt | self.llm.with_structured_output(RiskAssessment)
        result = chain.invoke({
            "business_category": state["business_category"],
            "location": state["location"],
            "capital": state["capital"],
            "market_summary": market_summary
        })

        weighted_risk = (
            0.4 * result.market_risk +
            0.3 * result.financial_risk +
            0.3 * result.operational_risk
        )

        return {
            "risk_assessment": result,
            "messages": [AIMessage(content=f"Risk assessment completed. Weighted risk: {weighted_risk:.2f}")]
        }

    def _recommendation_agent(self, state: AgentState) -> dict:
        """
        Final Recommendation Agent
        Synthesizes all analyses into a GO/NO-GO decision
        """
        prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a Final Decision Agent for rural business financing.
Provide clear, actionable recommendations in simple language (8th grade reading level).
Use both Hindi and English terms where appropriate."""),
            ("human", """Provide final recommendation:

Business: {business_category} in {location}
Capital: ₹{capital}

Market Analysis:
- Demand: {demand}
- Strengths: {strengths}
- Weaknesses: {weaknesses}

Risk Assessment:
- Overall Risk: {overall_risk:.2f}
- Top Risks: {risks}
- Safer Loan: ₹{safer_loan:.0f}

Decision Options:
- GO: Green light, proceed as planned
- MODIFY: Viable but needs changes (specify what to modify)
- DO_NOT_INVEST_YET: Too risky, need more preparation

Provide:
1. Final decision
2. Clear rationale (3-5 sentences)
3. Confidence level (0-1)
4. If MODIFY: specific modifications needed
5. Next steps (3-5 actionable items)""")
        ])

        overall_risk = (
            0.4 * state["risk_assessment"].market_risk +
            0.3 * state["risk_assessment"].financial_risk +
            0.3 * state["risk_assessment"].operational_risk
        )

        chain = prompt | self.llm.with_structured_output(FinalRecommendation)
        result = chain.invoke({
            "business_category": state["business_category"],
            "location": state["location"],
            "capital": state["capital"],
            "demand": state["market_analysis"].demand_level,
            "strengths": ", ".join(state["market_analysis"].swot_strengths[:2]),
            "weaknesses": ", ".join(state["market_analysis"].swot_weaknesses[:2]),
            "overall_risk": overall_risk,
            "risks": ", ".join(state["risk_assessment"].top_risks),
            "safer_loan": state["risk_assessment"].safer_loan_amount
        })

        return {
            "final_recommendation": result,
            "messages": [AIMessage(content=f"Final decision: {result.decision}")]
        }

    def _build_graph(self) -> StateGraph:
        """Build the LangGraph multi-agent workflow"""
        workflow = StateGraph(AgentState)

        # Add nodes (agents)
        workflow.add_node("retrieve", self._retrieve_context)
        workflow.add_node("market_analyst", self._market_analyst_agent)
        workflow.add_node("risk_actuary", self._risk_actuary_agent)
        workflow.add_node("recommendation", self._recommendation_agent)

        # Connect edges (linear pipeline)
        workflow.set_entry_point("retrieve")
        workflow.add_edge("retrieve", "market_analyst")
        workflow.add_edge("market_analyst", "risk_actuary")
        workflow.add_edge("risk_actuary", "recommendation")
        workflow.add_edge("recommendation", END)

        return workflow.compile()

    async def generate_report(
        self,
        business_id: str,
        business_category: str,
        location: str,
        capital: float
    ) -> dict:
        """
        Main entry point: Generate a complete feasibility report

        Returns:
            dict with keys: market_analysis, risk_assessment, final_recommendation
        """
        initial_state = AgentState(
            business_id=business_id,
            business_category=business_category,
            location=location,
            capital=capital,
            retrieved_context="",
            market_analysis=None,
            risk_assessment=None,
            final_recommendation=None,
            messages=[]
        )

        # Run the multi-agent pipeline
        final_state = await self.graph.ainvoke(initial_state)

        return {
            "business_id": business_id,
            "market_analysis": final_state["market_analysis"].dict(),
            "risk_assessment": final_state["risk_assessment"].dict(),
            "final_recommendation": final_state["final_recommendation"].dict(),
            "metadata": {
                "retrieved_context": final_state["retrieved_context"],
                "agent_messages": [msg.content for msg in final_state["messages"]]
            }
        }


# Singleton instance
_pipeline_instance = None

def get_rag_pipeline() -> GroqRAGPipeline:
    """Get or create the RAG pipeline singleton"""
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = GroqRAGPipeline()
    return _pipeline_instance
