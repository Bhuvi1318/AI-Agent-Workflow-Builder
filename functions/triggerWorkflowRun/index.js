require("dotenv").config();

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const GRAPHQL_URL =
  process.env.NHOST_GRAPHQL_URL;

const ADMIN_SECRET =
  process.env.NHOST_ADMIN_SECRET;

async function graphqlRequest(query, variables = {}) {
  const response = await fetch(
    GRAPHQL_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret":
          ADMIN_SECRET,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    }
  );

  const data = await response.json();

  if (data.errors) {
    throw new Error(
      data.errors[0].message
    );
  }

  return data.data;
}

async function triggerWorkflowRun(
  workflowRunId
) {
  try {
    console.log(
      "Starting workflow run:",
      workflowRunId
    );

    // --------------------------------
    // 1. Get pending step
    // --------------------------------

    const stepQuery = `
      query GetStepRun(
        $workflow_run_id: uuid!
      ) {
        step_runs(
          where: {
            workflow_run_id: {
              _eq: $workflow_run_id
            }
            status: {
              _eq: "pending"
            }
          }
          order_by: {
            id: asc
          }
          limit: 1
        ) {
          id
          workflow_run_id
          workflow_step_id
          status
          attempt_count
          input

          workflow_step {
            id
            name
            type
            position
          }
        }
      }
    `;

    const stepData =
      await graphqlRequest(
        stepQuery,
        {
          workflow_run_id:
            workflowRunId,
        }
      );

    const stepRun =
      stepData.step_runs?.[0];

    if (!stepRun) {
      throw new Error(
        "No pending step found"
      );
    }

    console.log(
      "Step found:",
      stepRun.id
    );

    // --------------------------------
    // 2. Mark step as running
    // --------------------------------

    const updateStepRunning = `
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

    await graphqlRequest(
      updateStepRunning,
      {
        id: stepRun.id,
      }
    );

    // --------------------------------
    // 3. Prepare AI input
    // --------------------------------

    let userInput =
      stepRun.input;

    if (!userInput) {
      userInput =
        "Give a helpful response to the user.";
    }

    // --------------------------------
    // 4. Call OpenAI
    // --------------------------------

    console.log(
      "Calling OpenAI..."
    );

    const completion =
      await openai.chat.completions.create(
        {
          model: "gpt-4o-mini",

          messages: [
            {
              role: "system",
              content:
                "You are an AI assistant executing a workflow step. Give a helpful and concise response.",
            },

            {
              role: "user",
              content: String(
                userInput
              ),
            },
          ],
        }
      );

    const output =
      completion.choices?.[0]
        ?.message?.content || "";

    console.log(
      "OpenAI response received."
    );

    // --------------------------------
    // 5. Save step output
    // --------------------------------

    const updateStepCompleted = `
      mutation CompleteStep(
        $id: uuid!
        $output: String!
      ) {
        update_step_runs_by_pk(
          pk_columns: {
            id: $id
          }
          _set: {
            status: "completed"
            output: $output
            error: null
          }
        ) {
          id
          status
          output
          error
        }
      }
    `;

    await graphqlRequest(
      updateStepCompleted,
      {
        id: stepRun.id,
        output,
      }
    );

    // --------------------------------
    // 6. Complete workflow run
    // --------------------------------

    const updateWorkflowCompleted = `
      mutation CompleteWorkflow(
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
        }
      }
    `;

    await graphqlRequest(
      updateWorkflowCompleted,
      {
        id: workflowRunId,
      }
    );

    console.log(
      "Workflow completed successfully."
    );

    return {
      success: true,
      workflowRunId,
      stepRunId: stepRun.id,
      output,
    };

  } catch (error) {

    console.error(
      "Workflow execution failed:",
      error
    );

    // --------------------------------
    // Save error to step
    // --------------------------------

    try {
      if (workflowRunId) {

        const errorQuery = `
          query FindStep(
            $workflow_run_id: uuid!
          ) {
            step_runs(
              where: {
                workflow_run_id: {
                  _eq: $workflow_run_id
                }
              }
              order_by: {
                id: asc
              }
              limit: 1
            ) {
              id
            }
          }
        `;

        const result =
          await graphqlRequest(
            errorQuery,
            {
              workflow_run_id:
                workflowRunId,
            }
          );

        const stepId =
          result.step_runs?.[0]?.id;

        if (stepId) {

          const updateError = `
            mutation UpdateStepError(
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

          await graphqlRequest(
            updateError,
            {
              id: stepId,
              error:
                error.message ||
                "Unknown workflow error",
            }
          );
        }

        // Complete workflow as failed

        const updateWorkflowError = `
          mutation FailWorkflow(
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

        await graphqlRequest(
          updateWorkflowError,
          {
            id: workflowRunId,
            error:
              error.message ||
              "Unknown workflow error",
          }
        );
      }

    } catch (dbError) {
      console.error(
        "Failed to save workflow error:",
        dbError
      );
    }

    return {
      success: false,
      error:
        error.message ||
        "Workflow execution failed",
    };
  }
}

module.exports = {
  triggerWorkflowRun,
};