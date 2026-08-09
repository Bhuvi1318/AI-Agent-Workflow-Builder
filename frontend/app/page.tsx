"use client";

import { useState } from "react";

type WorkflowRun = {
  id?: string;
  status?: string;
};

type StepRun = {
  id?: string;
  status?: string;
  output?: {
    response?: string;
    model?: string;
    provider?: string;
    user_input?: string;
    generated_at?: string;
  };
};

export default function Home() {
  const [userInput, setUserInput] =
    useState("");

  const [status, setStatus] =
    useState("Pending");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [runId, setRunId] =
    useState("");

  const [aiOutput, setAiOutput] =
    useState("");

  const [model, setModel] =
    useState("");

  /* =================================================
     RUN WORKFLOW
  ================================================= */

  const runWorkflow = async () => {
    /* -----------------------------------------------
       Validate input
    ------------------------------------------------ */

    if (!userInput.trim()) {
      setError(
        "Please enter a question or request first."
      );

      setStatus("Pending");

      return;
    }

    /* -----------------------------------------------
       Reset UI
    ------------------------------------------------ */

    setLoading(true);

    setError("");

    setRunId("");

    setAiOutput("");

    setModel("");

    setStatus("Running...");

    try {
      /* ---------------------------------------------
         Call backend
      --------------------------------------------- */

      const response =
        await fetch(
          "/api/run-workflow",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              input:
                userInput.trim(),
            }),
          }
        );

      /* ---------------------------------------------
         Read response
      --------------------------------------------- */

      const data =
        await response.json();

      console.log(
        "Workflow API response:",
        data
      );

      /* ---------------------------------------------
         Check error
      --------------------------------------------- */

      if (
        !response.ok ||
        !data.success
      ) {
        const message =
          data.error ||
          "Failed to run workflow";

        setStatus("Failed");

        setError(message);

        console.error(
          "Workflow API error:",
          message
        );

        return;
      }

      /* ---------------------------------------------
         Workflow run
      --------------------------------------------- */

      const workflowRun:
        WorkflowRun =
        data.workflowRun || {};

      /* ---------------------------------------------
         Step run
      --------------------------------------------- */

      const stepRun:
        StepRun =
        data.stepRun || {};

      /* ---------------------------------------------
         Run ID
      --------------------------------------------- */

      setRunId(
        workflowRun.id || ""
      );

      /* ---------------------------------------------
         Status
      --------------------------------------------- */

      if (
        workflowRun.status ===
        "completed"
      ) {
        setStatus(
          "Completed"
        );
      } else {
        setStatus(
          "Running..."
        );
      }

      /* ---------------------------------------------
         AI response
      --------------------------------------------- */

      let responseText =
        "";

      let responseModel =
        "";

      /* ---------------------------------------------
         Read from API aiOutput
      --------------------------------------------- */

      if (
        data.aiOutput?.response
      ) {
        responseText =
          data.aiOutput.response;

        responseModel =
          data.aiOutput.model ||
          "qwen2.5:3b";
      }

      /* ---------------------------------------------
         Fallback: stepRun output
      --------------------------------------------- */

      else if (
        stepRun.output?.response
      ) {
        responseText =
          stepRun.output.response;

        responseModel =
          stepRun.output.model ||
          "qwen2.5:3b";
      }

      /* ---------------------------------------------
         Update UI
      --------------------------------------------- */

      setAiOutput(
        responseText
      );

      setModel(
        responseModel ||
          "qwen2.5:3b"
      );

      console.log(
        "AI response:",
        responseText
      );

    } catch (error: any) {

      /* ---------------------------------------------
         Frontend error
      --------------------------------------------- */

      console.error(
        "Frontend error:",
        error
      );

      setStatus(
        "Failed"
      );

      setError(
        error?.message ||
          "Failed to connect to workflow API"
      );

    } finally {

      setLoading(
        false
      );
    }
  };

  /* =================================================
     UI
  ================================================= */

  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-8">

      <div className="max-w-6xl mx-auto">

        {/* ==========================================
            HEADER
        =========================================== */}

        <h1 className="text-4xl font-bold">
          AI Agent Workflow Builder
        </h1>

        <p className="text-slate-400 mt-2 mb-8">
          Create, manage and run AI workflows
        </p>

        {/* ==========================================
            STATISTICS
        =========================================== */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

          {/* Organization */}

          <div className="bg-slate-900 rounded-xl p-6">

            <p className="text-slate-400">
              Organization
            </p>

            <h2 className="text-xl font-semibold mt-2">
              My Organization
            </h2>

          </div>

          {/* Workflows */}

          <div className="bg-slate-900 rounded-xl p-6">

            <p className="text-slate-400">
              Workflows
            </p>

            <h2 className="text-3xl font-bold mt-2">
              1
            </h2>

          </div>

          {/* Quota */}

          <div className="bg-slate-900 rounded-xl p-6">

            <p className="text-slate-400">
              Quota
            </p>

            <h2 className="text-3xl font-bold mt-2">
              Local AI
            </h2>

          </div>

        </div>

        {/* ==========================================
            WORKFLOW CARD
        =========================================== */}

        <div className="bg-slate-900 rounded-xl p-6">

          {/* Workflow title */}

          <div>

            <h2 className="text-xl font-semibold">
              My First Workflow
            </h2>

            <p className="text-slate-400 mt-1">
              My first AI workflow
            </p>

          </div>

          {/* ========================================
              USER INPUT
          ========================================= */}

          <div className="mt-8">

            <label
              htmlFor="userInput"
              className="block font-semibold mb-3"
            >
              User Input
            </label>

            <textarea
              id="userInput"
              value={userInput}
              onChange={(event) =>
                setUserInput(
                  event.target.value
                )
              }
              placeholder="Example: Explain Java inheritance in simple words"
              rows={5}
              disabled={loading}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none disabled:opacity-60"
            />

            <p className="text-xs text-slate-500 mt-2">
              Ask anything. Your request will be
              processed locally using Qwen 2.5 3B.
            </p>

            {/* Run button */}

            <button
              onClick={runWorkflow}
              disabled={loading}
              className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-medium transition"
            >
              {loading
                ? "Running..."
                : "▶ Run Workflow"}
            </button>

          </div>

          {/* ========================================
              ERROR
          ========================================= */}

          {error && (
            <div className="mt-6 border border-red-800 bg-red-950/40 rounded-lg p-4">

              <p className="text-red-400 font-semibold text-lg">
                Workflow Error
              </p>

              <p className="text-red-300 text-sm mt-1 break-words">
                {error}
              </p>

            </div>
          )}

          {/* ========================================
              RUNNING
          ========================================= */}

          {status === "Running..." && (
            <div className="mt-6 border border-blue-800 bg-blue-950/40 rounded-lg p-4">

              <p className="text-blue-400 font-semibold">
                Workflow is running...
              </p>

              <p className="text-blue-300 text-sm mt-1">
                Qwen 2.5 3B is processing your request.
              </p>

            </div>
          )}

          {/* ========================================
              SUCCESS
          ========================================= */}

          {runId &&
            status === "Completed" && (
              <div className="mt-6 border border-green-800 bg-green-950/40 rounded-lg p-4">

                <p className="text-green-400 font-semibold text-lg">
                  ✓ Workflow completed successfully
                </p>

                <p className="text-green-300 text-sm mt-2 break-all">
                  Run ID: {runId}
                </p>

              </div>
            )}

          {/* ========================================
              WORKFLOW STEPS
          ========================================= */}

          <div className="mt-8">

            <h3 className="font-semibold mb-4 text-lg">
              Workflow Steps
            </h3>

            <div className="border border-slate-700 rounded-lg p-5">

              <div className="flex justify-between items-center">

                {/* Step */}

                <div className="flex items-center">

                  <span className="mr-3 text-2xl">
                    🤖
                  </span>

                  <div>

                    <p className="font-medium text-lg">
                      AI Response
                    </p>

                    <p className="text-xs text-slate-500">
                      LLM
                    </p>

                  </div>

                </div>

                {/* Status */}

                <span
                  className={
                    status ===
                    "Completed"
                      ? "text-green-400 font-semibold"
                      : status ===
                        "Failed"
                      ? "text-red-400 font-semibold"
                      : status ===
                        "Running..."
                      ? "text-blue-400 font-semibold"
                      : "text-yellow-400 font-semibold"
                  }
                >
                  {status}
                </span>

              </div>

            </div>

          </div>

          {/* ========================================
              AI RESPONSE
          ========================================= */}

          {aiOutput && (
            <div className="mt-8">

              <h3 className="font-semibold mb-4 text-lg">
                AI Response
              </h3>

              <div className="border border-slate-700 bg-slate-950 rounded-lg p-5">

                {/* Model information */}

                <div className="flex flex-wrap gap-2 mb-5">

                  <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">
                    Model: {model}
                  </span>

                  <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-full">
                    Provider: Ollama
                  </span>

                  <span className="text-xs bg-green-900/50 text-green-400 px-3 py-1 rounded-full">
                    Local AI
                  </span>

                </div>

                {/* User question */}

                <div className="mb-5">

                  <p className="text-xs text-slate-500 mb-2">
                    Your question
                  </p>

                  <p className="text-slate-300 whitespace-pre-wrap">
                    {userInput}
                  </p>

                </div>

                {/* AI answer */}

                <div>

                  <p className="text-xs text-slate-500 mb-2">
                    AI answer
                  </p>

                  <p className="text-slate-200 leading-7 whitespace-pre-wrap">
                    {aiOutput}
                  </p>

                </div>

              </div>

            </div>
          )}

        </div>

      </div>

    </main>
  );
}