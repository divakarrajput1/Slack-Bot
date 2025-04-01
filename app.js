require("dotenv").config();
const { App, ExpressReceiver } = require("@slack/bolt");
const express = require("express");

// 1. Initialize ExpressReceiver (Bolt's built-in Express)
const expressReceiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  endpoints: {
    commands: "/slack/commands", // Explicit endpoint for slash commands
    events: "/slack/events", // For future event subscriptions
  },
});

// 2. Create Bolt app with ExpressReceiver
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: expressReceiver,
});

// 3. Add health check route
expressReceiver.app.get("/", (req, res) => {
  res.status(200).send("Approval Bot is running!");
});

// 4. Slash command handler
slackApp.command("/approval-boto", async ({ command, ack, client }) => {
  await ack();

  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: {
        type: "modal",
        callback_id: "approval_modal",
        title: { type: "plain_text", text: "Request Approval" },
        submit: { type: "plain_text", text: "Submit" },
        blocks: [
          {
            type: "input",
            block_id: "approver_block",
            element: {
              type: "users_select",
              placeholder: { type: "plain_text", text: "Select approver" },
              action_id: "approver_select",
            },
            label: { type: "plain_text", text: "Approver" },
          },
          {
            type: "input",
            block_id: "description_block",
            element: {
              type: "plain_text_input",
              multiline: true,
              action_id: "description_input",
            },
            label: { type: "plain_text", text: "Description" },
          },
        ],
      },
    });
  } catch (error) {
    console.error("Modal error:", error);
  }
});

// 5. Modal submission handler
slackApp.view("approval_modal", async ({ ack, body, view, client }) => {
  await ack();

  const requester = body.user.id;
  const approver =
    view.state.values.approver_block.approver_select.selected_user;
  const description =
    view.state.values.description_block.description_input.value;

  try {
    await client.chat.postMessage({
      channel: approver,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*New Approval Request*\n\n<@${requester}> requests approval for:\n\n${description}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "✅ Approve" },
              style: "primary",
              action_id: "approve_action",
              value: requester,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "❌ Reject" },
              style: "danger",
              action_id: "reject_action",
              value: requester,
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("Message send error:", error);
  }
});

// 6. Approval handler
slackApp.action("approve_action", async ({ ack, body, action, client }) => {
  await ack();

  await client.chat.postMessage({
    channel: action.value,
    text: `🎉 Your request was approved by <@${body.user.id}>!`,
  });

  await client.chat.update({
    channel: body.container.channel_id,
    ts: body.container.message_ts,
    text: `Approved by <@${body.user.id}>`,
    blocks: [], // Clear interactive buttons
  });
});

// 7. Rejection handler
slackApp.action("reject_action", async ({ ack, body, action, client }) => {
  await ack();

  await client.chat.postMessage({
    channel: action.value,
    text: `❌ Your request was rejected by <@${body.user.id}>`,
  });

  await client.chat.update({
    channel: body.container.channel_id,
    ts: body.container.message_ts,
    text: `Rejected by <@${body.user.id}>`,
    blocks: [], // Clear interactive buttons
  });
});

// 8. Error handling
slackApp.error((error) => {
  console.error("Global error:", error);
});

// 9. Start the app
(async () => {
  await slackApp.start(process.env.PORT || 3000);
  console.log(`⚡ Bot running on port ${process.env.PORT || 3000}`);
})();

module.exports = { slackApp };
