# Product Requirement

## Product Name
Knowledge Foundry

## Overview
Build a product that turns a collection of raw research materials into an LLM-maintained knowledge base. The system should ingest source documents into a raw knowledge store, compile them into a structured markdown wiki, let users ask complex questions against that wiki, and continuously enhance the knowledge base through agent-driven maintenance workflows.

## Problem
Current personal research workflows are fragmented across bookmarks, PDFs, notes apps, and ad hoc scripts. Valuable context is scattered, difficult to query, and hard to evolve over time. Existing tooling often stops at search or simple note capture, while the user’s desired workflow is iterative: gather sources, compile knowledge, ask questions, generate artifacts, and feed those outputs back into the system.

## Users
- Individual researchers tracking a topic over weeks or months
- Founders or product teams building market, technical, or competitor knowledge bases
- Power users who already work in markdown and want an Obsidian-friendly workflow

## Product Goal
Enable a user to point the system at a corpus of source material and get a living markdown knowledge base that:
- organizes concepts and source summaries automatically
- supports agent-driven question answering and synthesis
- generates derived outputs such as notes, reports, slides, and visualizations
- improves itself over time through health checks and maintenance jobs

## Core User Journey
1. User ingests raw materials such as web articles, papers, repos, datasets, markdown notes, and images.
2. The system stores the original assets in a `raw/` area with metadata and source references.
3. An LLM compilation pipeline transforms the corpus into a structured wiki in markdown.
4. The user explores the knowledge base in an Obsidian-style file workspace.
5. The user asks a question or requests an artifact such as a report or slide deck.
6. An agent researches the answer using the wiki and raw materials, then writes the result back as markdown, slides, or images.
7. Maintenance agents run health checks to find inconsistencies, missing links, stale summaries, and candidate new articles.

## Scope
- Ingest local and web-derived source files into a managed corpus
- Maintain a markdown-first wiki with backlinks, concept pages, and source summaries
- Expose an orchestration layer for compile, QA, and review style workflows
- Provide a web app for browsing the knowledge base and triggering jobs
- Provide a backend API for ingest, compile, search, query, artifact generation, and health checks
- Support Obsidian-compatible files as a first-class storage and export format
- Keep all generated outputs file-based and easy to inspect

## MVP Capabilities
- Corpus browser showing raw sources, compiled wiki pages, and generated outputs
- Ingestion job that registers raw files and normalizes metadata
- Compile job that creates or updates markdown wiki pages from raw content
- Search and question-answer workflow over the wiki and supporting source summaries
- Artifact generation for markdown reports and Marp slide decks
- Health check job that flags wiki inconsistencies and suggests missing pages or connections
- `/health` style system status endpoint for orchestration and UI visibility

## Non-Goals
- Building a full real-time collaborative editor
- Solving large-scale distributed retrieval for huge corpora in v1
- Training or fine-tuning a custom model in the first milestone
- Replacing Obsidian itself as the primary local authoring environment

## Constraints
- Markdown files are the canonical knowledge output
- Raw and derived data must remain inspectable on disk
- The system should work at small-to-medium corpus sizes without requiring a heavy RAG stack
- Generated outputs should be easy to file back into the wiki
- Architecture should allow later expansion into synthetic data generation and fine-tuning workflows

## Success Criteria
- A user can ingest a set of source materials and get a coherent markdown wiki without manual file editing
- A user can ask a research question and receive a generated markdown or slide artifact grounded in the knowledge base
- The system can run automated health checks that improve wiki consistency over time
- The resulting project structure remains understandable enough for a single user or small team to operate

## Requirement Sources & Inspirations

### 1. Karpathy's LLM OS Architecture
The core philosophy and architectural design of Knowledge Foundry are heavily inspired by Andrej Karpathy's "LLM OS" (Large Language Model Operating System) concept. In this paradigm, computing is reimagined with the LLM at the center:

*   **CPU (Cognitive Core)**: The Large Language Model acts as the main reasoning engine. Instead of deterministic code, it executes tasks based on natural language instructions.
*   **RAM (Context Window)**: The bounded working memory the model uses to hold immediate context during processing.
*   **Storage (Hard Drive)**: Long-term memory managed through local markdown files and vector databases (the `data/wiki` structure).
*   **System Calls (Tool Use)**: The LLM orchestrates actions by calling external tools (e.g., Python interpreters, web crawlers, compilers) as system calls.
*   **Peripherals (I/O)**: Multimodal inputs and outputs (vision, audio, web interactions).

Knowledge Foundry implements this by treating the Markdown workspace as the filesystem, and its background agents (Nanobots, Hermes) as system processes orchestrated by the LLM kernel.

### 2. Dashboard Interface (核心全景掌控仪)
The physical manifestation of this LLM OS is a central control panel that provides real-time observability into the agent runtime and knowledge graph.

![Knowledge Foundry Dashboard UI](assets/dashboard-ui.png)
*This reference screenshot defines the visual orchestration layer, featuring multi-thread cognitive mapping, real-time node linking, and the operations dashboard for agentic workflows (Brainstorm, Compile, Reconcile).*
