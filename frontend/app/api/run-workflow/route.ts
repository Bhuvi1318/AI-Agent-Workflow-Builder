import { NextResponse } from "next/server";
import { GraphQLClient, gql } from "graphql-request";

/* =====================================================
   WORKFLOW CONFIGURATION
===================================================== */

const WORKFLOW_ID =
  "23121b2e-5975-416c-854a-4c53bf596124";

/* =====================================================
   LOCAL OLLAMA CONFIGURATION
===================================================== */

const OLLAMA_URL =
  "http://127.0.0.1:11434/api/generate";

const OLLAMA_MODEL =
  "qwen2.5:3b";

/* =====================================================
   GEMINI CONFIGURATION
===================================================== */

const GEMINI_MODEL =
  "gemini-2.5-flash-lite";

/* =====================================================
   GET WORKFLOW
===================================================== */

const GET_WORKFLOW = gql`
  query GetWorkflow($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      name
      description

      workflow_steps(
        order_by: { position: asc }
      ) {
        id
        position
        type
        name
      }
    }
  }
`;

/* =====================================================
   CREATE WORKFLOW RUN
===================================================== */

const CREATE_WORKFLOW_RUN = gql`
  mutation CreateWorkflowRun(
    $workflow_id: uuid!
    $status: String!
    $started_at: timestamptz!
    $completed_at: timestamptz!
    $error: String!
  ) {
    insert_workflow_runs_one(
      object: {
        workflow_id: $workflow_id
        status: $status
        started_at: $started_at
        completed_at: $completed_at
        error: $error
      }
    ) {
      id
      workflow_id
      status
      started_at
      completed_at
      error
    }
  }
`;

/* =====================================================
   CREATE STEP RUN
===================================================== */

const CREATE_STEP_RUN = gql`
  mutation CreateStepRun(
    $workflow_run_id: uuid!
    $workflow_step_id: uuid!
    $status: String!
    $attempt_count: Int!
  ) {
    insert_step_runs_one(
      object: {
        workflow_run_id: $workflow_run_id
        workflow_step_id: $workflow_step_id
        status: $status
        attempt_count: $attempt_count
      }
    ) {
      id
      workflow_run_id
      workflow_step_id
      status
      attempt_count
      input
      output
      error
    }
  }
`;

/* =====================================================
   UPDATE STEP RUNNING
===================================================== */

const UPDATE_STEP_RUNNING = gql`
  mutation UpdateStepRunning(
    $id: uuid!
  ) {
    update_step_runs_by_pk(
      pk_columns: {
        id: $id
      }
      _set: {
        status: "running"
      }
    ) {
      id
      status
    }
  }
`;

/* =====================================================
   UPDATE STEP COMPLETED
   output is JSONB
===================================================== */

const UPDATE_STEP_COMPLETED = gql`
  mutation UpdateStepCompleted(
    $id: uuid!
    $output: jsonb!
  ) {
    update_step_runs_by_pk(
      pk_columns: {
        id: $id
      }
      _set: {
        status: "completed"
        output: $output
      }
    ) {
      id
      status
      output
      error
    }
  }
`;

/* =====================================================
   UPDATE STEP FAILED
===================================================== */

const UPDATE_STEP_FAILED = gql`
  mutation UpdateStepFailed(
    $id: uuid!
    $error: String!
  ) {
    update_step_runs_by_pk(
      pk_columns: {
        id: $id
      }
      _set: {
        status: "failed"
        error: $error
      }
    ) {
      id
      status
      error
    }
  }
`;

/* =====================================================
   UPDATE WORKFLOW COMPLETED
===================================================== */

const UPDATE_WORKFLOW_COMPLETED = gql`
  mutation UpdateWorkflowCompleted(
    $id: uuid!
  ) {
    update_workflow_runs_by_pk(
      pk_columns: {
        id: $id
      }
      _set: {
        status: "completed"
      }
    ) {
      id
      status
      error
    }
  }
`;

/* =====================================================
   UPDATE WORKFLOW FAILED
===================================================== */

const UPDATE_WORKFLOW_FAILED = gql`
  mutation UpdateWorkflowFailed(
    $id: uuid!
    $error: String!
  ) {
    update_workflow_runs_by_pk(
      pk_columns: {
        id: $id
      }
      _set: {
        status: "failed"
        error: $error
      }
    ) {
      id
      status
      error
    }
  }
`;

/* =====================================================
   GEMINI AI CALL
===================================================== */

async function callGemini(
  prompt: string
): Promise<string> {

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is missing"
    );
  }

  console.log(
    "Calling Gemini..."
  );

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response =
    await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    });

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Gemini error ${response.status}: ${errorText}`
    );
  }

  const data =
    await response.json();

  const output =
    data?.candidates?.[0]?.content?.parts
      ?.map(
        (part: any) =>
          part?.text || ""
      )
      .join("")
      .trim();

  if (!output) {
    throw new Error(
      "Gemini returned an empty response"
    );
  }

  console.log(
    "Gemini response received"
  );

  return output;
}

/* =====================================================
   LOCAL OLLAMA AI CALL
===================================================== */

async function callOllama(
  prompt: string
): Promise<string> {

  console.log(
    "Calling Ollama..."
  );

  const response =
    await fetch(
      OLLAMA_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          model:
            OLLAMA_MODEL,

          prompt,

          stream:
            false,
        }),
      }
    );

  if (!response.ok) {

    const errorText =
      await response.text();

    throw new Error(
      `Ollama error ${response.status}: ${errorText}`
    );
  }

  const data =
    await response.json();

  const output =
    typeof data.response ===
    "string"
      ? data.response.trim()
      : "";

  if (!output) {
    throw new Error(
      "Ollama returned an empty response"
    );
  }

  console.log(
    "Ollama response received"
  );

  return output;
}

/* =====================================================
   POST
===================================================== */

export async function POST(
  request: Request
) {

  let workflowRunId = "";
  let stepRunId = "";

  try {

    /* =================================================
       1. GET USER INPUT
    ================================================= */

    const body =
      await request.json();

    const userInput =
      typeof body.input === "string"
        ? body.input.trim()
        : "";

    if (!userInput) {

      return NextResponse.json(
        {
          success: false,

          error:
            "User input is required.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "User input:",
      userInput
    );

    /* =================================================
       2. ENVIRONMENT VARIABLES
    ================================================= */

    const graphqlUrl =
      process.env.NHOST_GRAPHQL_URL;

    const adminSecret =
      process.env.NHOST_ADMIN_SECRET;

    if (!graphqlUrl) {

      throw new Error(
        "NHOST_GRAPHQL_URL is missing"
      );
    }

    if (!adminSecret) {

      throw new Error(
        "NHOST_ADMIN_SECRET is missing"
      );
    }

    console.log(
      "GraphQL URL loaded: true"
    );

    console.log(
      "Nhost admin secret loaded: true"
    );

    console.log(
      "Gemini API key loaded:",
      !!process.env.GEMINI_API_KEY
    );

    /* =================================================
       3. GRAPHQL CLIENT
    ================================================= */

    const client =
      new GraphQLClient(
        graphqlUrl,
        {
          headers: {
            "Content-Type":
              "application/json",

            "x-hasura-admin-secret":
              adminSecret,
          },
        }
      );

    /* =================================================
       4. GET WORKFLOW
    ================================================= */

    console.log(
      "Getting workflow..."
    );

    const workflowData =
      await client.request(
        GET_WORKFLOW,
        {
          id:
            WORKFLOW_ID,
        }
      );

    const workflow =
      workflowData.workflows_by_pk;

    if (!workflow) {

      throw new Error(
        "Workflow not found"
      );
    }

    console.log(
      "Workflow found:",
      workflow.name
    );

    /* =================================================
       5. CHECK WORKFLOW STEPS
    ================================================= */

    if (
      !workflow.workflow_steps ||
      workflow.workflow_steps.length === 0
    ) {

      throw new Error(
        "Workflow has no steps"
      );
    }

    const firstStep =
      workflow.workflow_steps[0];

    console.log(
      "Step found:",
      firstStep.name
    );

    console.log(
      "Step type:",
      firstStep.type
    );

    /* =================================================
       6. CREATE WORKFLOW RUN
    ================================================= */

    const startTime =
      new Date().toISOString();

    console.log(
      "Creating workflow run..."
    );

    const runData =
      await client.request(
        CREATE_WORKFLOW_RUN,
        {
          workflow_id:
            workflow.id,

          status:
            "pending",

          started_at:
            startTime,

          completed_at:
            startTime,

          error:
            "",
        }
      );

    const workflowRun =
      runData.insert_workflow_runs_one;

    if (!workflowRun) {

      throw new Error(
        "Workflow run was not created"
      );
    }

    workflowRunId =
      workflowRun.id;

    console.log(
      "Workflow run created:",
      workflowRunId
    );

    /* =================================================
       7. CREATE STEP RUN
    ================================================= */

    console.log(
      "Creating step run..."
    );

    const stepData =
      await client.request(
        CREATE_STEP_RUN,
        {
          workflow_run_id:
            workflowRunId,

          workflow_step_id:
            firstStep.id,

          status:
            "pending",

          attempt_count:
            1,
        }
      );

    const stepRun =
      stepData.insert_step_runs_one;

    if (!stepRun) {

      throw new Error(
        "Step run was not created"
      );
    }

    stepRunId =
      stepRun.id;

    console.log(
      "Step run created:",
      stepRunId
    );

    /* =================================================
       8. MARK STEP RUNNING
    ================================================= */

    await client.request(
      UPDATE_STEP_RUNNING,
      {
        id:
          stepRunId,
      }
    );

    console.log(
      "Step status: running"
    );

    /* =================================================
       9. PREPARE AI PROMPT
    ================================================= */

    const prompt = `
You are an AI assistant executing a workflow step.

Answer the user's request clearly, accurately and helpfully.

User request:
${userInput}

Give only the useful answer to the user's request.
`;

    /* =================================================
       10. CALL AI
       
       Production/Vercel:
       Gemini

       Local development without Gemini key:
       Ollama
    ================================================= */

    let output = "";
    let provider = "";
    let model = "";

    if (
      process.env.GEMINI_API_KEY
    ) {

      console.log(
        "AI provider: Gemini"
      );

      output =
        await callGemini(
          prompt
        );

      provider =
        "gemini";

      model =
        GEMINI_MODEL;

    } else {

      console.log(
        "AI provider: Ollama"
      );

      output =
        await callOllama(
          prompt
        );

      provider =
        "ollama";

      model =
        OLLAMA_MODEL;
    }

    console.log(
      "AI output length:",
      output.length
    );

    /* =================================================
       11. SAVE OUTPUT AS JSONB
    ================================================= */

    const outputJson = {

      response:
        output,

      model:
        model,

      provider:
        provider,

      user_input:
        userInput,

      generated_at:
        new Date().toISOString(),
    };

    console.log(
      "Saving AI output..."
    );

    const completedStep =
      await client.request(
        UPDATE_STEP_COMPLETED,
        {
          id:
            stepRunId,

          output:
            outputJson,
        }
      );

    console.log(
      "Step marked completed"
    );

    /* =================================================
       12. MARK WORKFLOW COMPLETED
    ================================================= */

    const completedWorkflow =
      await client.request(
        UPDATE_WORKFLOW_COMPLETED,
        {
          id:
            workflowRunId,
        }
      );

    console.log(
      "Workflow marked completed"
    );

    /* =================================================
       13. RETURN SUCCESS
    ================================================= */

    return NextResponse.json({

      success:
        true,

      message:
        "Workflow completed successfully",

      workflow: {

        id:
          workflow.id,

        name:
          workflow.name,

        description:
          workflow.description,
      },

      workflowRun:
        completedWorkflow
          .update_workflow_runs_by_pk,

      stepRun:
        completedStep
          .update_step_runs_by_pk,

      aiOutput:
        outputJson,
    });

  } catch (error: any) {

    /* =================================================
       ERROR LOG
    ================================================= */

    console.error(
      "===================================="
    );

    console.error(
      "WORKFLOW EXECUTION ERROR"
    );

    console.error(
      error
    );

    console.error(
      "Message:",
      error?.message
    );

    console.error(
      "===================================="
    );

    const errorMessage =
      error?.message ||
      "Workflow execution failed";

    /* =================================================
       SAVE ERROR TO DATABASE
    ================================================= */

    try {

      const graphqlUrl =
        process.env.NHOST_GRAPHQL_URL;

      const adminSecret =
        process.env.NHOST_ADMIN_SECRET;

      if (
        graphqlUrl &&
        adminSecret
      ) {

        const errorClient =
          new GraphQLClient(
            graphqlUrl,
            {
              headers: {
                "Content-Type":
                  "application/json",

                "x-hasura-admin-secret":
                  adminSecret,
              },
            }
          );

        /* ---------------------------------------------
           Mark step failed
        --------------------------------------------- */

        if (stepRunId) {

          await errorClient.request(
            UPDATE_STEP_FAILED,
            {
              id:
                stepRunId,

              error:
                errorMessage,
            }
          );

          console.log(
            "Step marked failed"
          );
        }

        /* ---------------------------------------------
           Mark workflow failed
        --------------------------------------------- */

        if (workflowRunId) {

          await errorClient.request(
            UPDATE_WORKFLOW_FAILED,
            {
              id:
                workflowRunId,

              error:
                errorMessage,
            }
          );

          console.log(
            "Workflow marked failed"
          );
        }
      }

    } catch (databaseError: any) {

      console.error(
        "Failed to save error:",
        databaseError?.message
      );
    }

    /* =================================================
       RETURN ERROR
    ================================================= */

    return NextResponse.json(
      {
        success:
          false,

        error:
          errorMessage,

        workflowRunId:
          workflowRunId ||
          null,

        stepRunId:
          stepRunId ||
          null,
      },
      {
        status:
          500,
      }
    );
  }
}