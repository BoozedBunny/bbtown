import { getPlayerProfileAndInventory, removeItemsFromInventory, addItemsToInventory } from "./inventoryService";
import { logTransaction } from "./ledgerService";
import { sendSystemMail } from "./mailService";

const STRAPI_BASE_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1339";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

function getStrapiServiceHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(STRAPI_API_TOKEN ? { Authorization: `Bearer ${STRAPI_API_TOKEN}` } : {}),
  };
}

export interface TradeItem {
  key: string;
  quantity: number;
}

export interface TradeProposalDTO {
  documentId: string;
  id: string | number;
  proposerName: string;
  receiverName: string;
  offeredCredits: number;
  requestedCredits: number;
  offeredItems: TradeItem[];
  requestedItems: TradeItem[];
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  createdAt: string;
}

// Emits real-time notifications to users
function notifyUsers(usernames: string[], event: "portfolio_updated" | "mail_updated") {
  const io = (global as any).io;
  if (io) {
    for (const u of usernames) {
      if (u) {
        io.to(`user:${u}`).emit(event);
      }
    }
  }
}

// 1. Propose Trade
export async function createTradeProposal(
  proposerUsername: string,
  receiverUsername: string,
  offeredCredits: number,
  requestedCredits: number,
  offeredItems: TradeItem[],
  requestedItems: TradeItem[]
): Promise<{ success: boolean; proposalDocId?: string; error?: string }> {
  const headers = getStrapiServiceHeaders();

  if (proposerUsername === receiverUsername) {
    return { success: false, error: "You cannot trade with yourself." };
  }
  if (offeredCredits < 0 || requestedCredits < 0) {
    return { success: false, error: "Credits cannot be negative." };
  }

  try {
    // A. Fetch Proposer
    const proposer = await getPlayerProfileAndInventory(proposerUsername);
    if (!proposer) return { success: false, error: `Proposer profile not found: ${proposerUsername}` };

    // B. Fetch Receiver
    const receiver = await getPlayerProfileAndInventory(receiverUsername);
    if (!receiver) return { success: false, error: `Receiver profile not found: ${receiverUsername}` };

    // C. Validate Proposer Balance
    if (proposer.wallet < offeredCredits) {
      return { success: false, error: `Insufficient credits in wallet. Available: $${proposer.wallet}` };
    }

    // D. Validate Proposer Inventory Items
    const proposerItemCounts: Record<string, number> = {};
    for (const slot of proposer.slots) {
      if (slot.item) {
        proposerItemCounts[slot.item.key] = (proposerItemCounts[slot.item.key] || 0) + slot.quantity;
      }
    }

    for (const offered of offeredItems) {
      const available = proposerItemCounts[offered.key] || 0;
      if (available < offered.quantity) {
        return { success: false, error: `Insufficient ${offered.key} in storage. Needed: ${offered.quantity}, In Stock: ${available}` };
      }
    }

    // E. Escrow proposer credits
    const proposerNewWallet = proposer.wallet - offeredCredits;
    const proposerUpdateRes = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${proposer.profileDocId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ data: { wallet: proposerNewWallet } }),
    });

    if (!proposerUpdateRes.ok) {
      throw new Error("Failed to deduct credits for escrow lock");
    }

    // F. Escrow proposer items
    for (const offered of offeredItems) {
      await removeItemsFromInventory(proposer.profileDocId, offered.key, offered.quantity);
    }

    // G. Create TradeProposal in Strapi
    const proposalRes = await fetch(`${STRAPI_BASE_URL}/api/trade-proposals`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          proposer: proposer.profileDocId,
          receiver: receiver.profileDocId,
          offeredCredits,
          requestedCredits,
          offeredItems,
          requestedItems,
          status: "PENDING",
        },
      }),
    });

    if (!proposalRes.ok) {
      const txt = await proposalRes.text();
      throw new Error(`Failed to save TradeProposal: ${txt}`);
    }

    const proposalJson = await proposalRes.json();
    const proposalDocId = proposalJson.data.documentId ?? String(proposalJson.data.id);

    // H. Log Ledger entry for proposer
    await logTransaction(
      proposer.profileDocId,
      -offeredCredits,
      "FEES",
      `Trade proposed to ${receiverUsername} (escrow lock: $${offeredCredits} credits + items)`
    );

    // I. Dispatch Trade Proposal mail notification to receiver
    const mailSubject = `TRADE PROPOSAL: Trade Proposal from ${proposerUsername}`;
    const mailBody = `PROPOSAL_ID:${proposalDocId}\n\nPlayer ${proposerUsername} has proposed a secure P2P trade with you.\n\n` +
      `- OFFERED (By ${proposerUsername}):\n` +
      `  * Credits: +$${offeredCredits}\n` +
      `  * Cargo: ${offeredItems.map(i => `${i.quantity}x ${i.key}`).join(", ") || "None"}\n\n` +
      `- REQUESTED (From You):\n` +
      `  * Credits: -$${requestedCredits}\n` +
      `  * Cargo: ${requestedItems.map(i => `${i.quantity}x ${i.key}`).join(", ") || "None"}\n\n` +
      `Open this cyber log directly in your Mail Inbox Terminal to ACCEPT or REJECT this trade request. All offered assets are securely locked in escrow.`;

    await sendSystemMail(receiver.profileDocId, mailSubject, mailBody, "TRADE_PROPOSAL");

    // J. Notify real-time WebSockets
    notifyUsers([proposerUsername], "portfolio_updated");
    notifyUsers([receiverUsername], "mail_updated");

    return { success: true, proposalDocId };
  } catch (error: any) {
    console.error("[tradeService] Error proposing trade:", error);
    return { success: false, error: error.message || "An unexpected error occurred during trade escrow." };
  }
}

// 2. Resolve Trade (ACCEPT / REJECT / CANCEL)
export async function resolveTradeProposal(
  proposalId: string,
  username: string,
  action: "ACCEPT" | "REJECT" | "CANCEL"
): Promise<{ success: boolean; error?: string }> {
  const headers = getStrapiServiceHeaders();

  try {
    // A. Fetch proposal details (populating proposer & receiver usernames and profiles)
    const proposalUrl = new URL(`${STRAPI_BASE_URL}/api/trade-proposals/${proposalId}`);
    proposalUrl.searchParams.set("populate[0]", "proposer");
    proposalUrl.searchParams.set("populate[1]", "receiver");
    const proposalRes = await fetch(proposalUrl, { headers, cache: "no-store" });
    if (!proposalRes.ok) {
      return { success: false, error: "Trade proposal not found." };
    }

    const proposalJson = await proposalRes.json();
    const proposal = proposalJson.data;
    if (!proposal) return { success: false, error: "Trade proposal not found." };

    const status = proposal.status;
    if (status !== "PENDING") {
      return { success: false, error: `This trade proposal is no longer pending (Current Status: ${status}).` };
    }

    const proposer = proposal.proposer;
    const receiver = proposal.receiver;
    if (!proposer || !receiver) {
      return { success: false, error: "Corrupted trade proposal profiles." };
    }

    const proposerUsername = proposer.displayName;
    const receiverUsername = receiver.displayName;
    const proposerDocId = proposer.documentId ?? String(proposer.id);
    const receiverDocId = receiver.documentId ?? String(receiver.id);

    const offeredCredits = Number(proposal.offeredCredits ?? 0);
    const requestedCredits = Number(proposal.requestedCredits ?? 0);
    const offeredItems: TradeItem[] = proposal.offeredItems ?? [];
    const requestedItems: TradeItem[] = proposal.requestedItems ?? [];

    // B. Validate Authority
    if (action === "CANCEL" && username !== proposerUsername) {
      return { success: false, error: "Only the proposer can cancel this trade proposal." };
    }
    if ((action === "ACCEPT" || action === "REJECT") && username !== receiverUsername) {
      return { success: false, error: "Only the receiver can accept or reject this trade proposal." };
    }

    // C. Action: REJECT or CANCEL (Full refunds to proposer)
    if (action === "REJECT" || action === "CANCEL") {
      // Refund proposer credits
      const currentProposerWallet = Number(proposer.wallet ?? 0);
      const proposerRefundRes = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${proposerDocId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { wallet: currentProposerWallet + offeredCredits } }),
      });
      if (!proposerRefundRes.ok) throw new Error("Failed to refund credits to proposer.");

      // Refund proposer items
      for (const offered of offeredItems) {
        // Since we are refunding, capacity check doesn't need to block unless player shrunk level (highly unlikely in normal play, but addItems handles space)
        await addItemsToInventory(proposerDocId, offered.key, offered.quantity, 40);
      }

      // Update proposal status
      const updatedStatus = action === "REJECT" ? "REJECTED" : "CANCELLED";
      const statusUpdateRes = await fetch(`${STRAPI_BASE_URL}/api/trade-proposals/${proposalId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { status: updatedStatus } }),
      });
      if (!statusUpdateRes.ok) throw new Error("Failed to update trade proposal status.");

      // Log transaction ledger for proposer
      await logTransaction(
        proposerDocId,
        offeredCredits,
        "TRADE_P2P",
        `Trade with ${receiverUsername} ${updatedStatus.toLowerCase()} (escrow refunded)`
      );

      // Send mail alerts
      const proposerMailSubject = `Trade Proposal ${updatedStatus}: ${receiverUsername}`;
      const proposerMailBody = `Your trade proposal to ${receiverUsername} was ${updatedStatus.toLowerCase()}.\n\nAll escrowed assets ($${offeredCredits} credits + items) have been safely refunded to your inventory.`;
      await sendSystemMail(proposerDocId, proposerMailSubject, proposerMailBody, "SYSTEM");

      if (action === "REJECT") {
        const receiverMailSubject = `Trade Proposal Rejected`;
        const receiverMailBody = `You rejected the trade proposal from ${proposerUsername}.`;
        await sendSystemMail(receiverDocId, receiverMailSubject, receiverMailBody, "SYSTEM");
      }

      notifyUsers([proposerUsername, receiverUsername], "portfolio_updated");
      notifyUsers([proposerUsername, receiverUsername], "mail_updated");

      return { success: true };
    }

    // D. Action: ACCEPT (Swap resources)
    if (action === "ACCEPT") {
      // 1. Fetch current receiver profile & inventory data to validate
      const receiverFull = await getPlayerProfileAndInventory(receiverUsername);
      if (!receiverFull) throw new Error("Receiver profile details not found.");

      // 2. Validate receiver balance
      if (receiverFull.wallet < requestedCredits) {
        return { success: false, error: `Insufficient credits. You need $${requestedCredits} but have $${receiverFull.wallet}` };
      }

      // 3. Validate receiver items
      const receiverItemCounts: Record<string, number> = {};
      for (const slot of receiverFull.slots) {
        if (slot.item) {
          receiverItemCounts[slot.item.key] = (receiverItemCounts[slot.item.key] || 0) + slot.quantity;
        }
      }

      for (const req of requestedItems) {
        const available = receiverItemCounts[req.key] || 0;
        if (available < req.quantity) {
          return { success: false, error: `Insufficient ${req.key} in your storage. Needed: ${req.quantity}, Available: ${available}` };
        }
      }

      // 4. Validate inventory slot capacities for both parties to prevent overflows
      const proposerFull = await getPlayerProfileAndInventory(proposerUsername);
      if (!proposerFull) throw new Error("Proposer profile details not found.");

      // Check proposer empty slots count (proposer will receive requestedItems)
      const proposerEmptySlots = proposerFull.slots.filter(s => s.item === null).length;
      const uniqueRequestedKeys = new Set(requestedItems.map(i => i.key)).size;
      if (proposerEmptySlots < uniqueRequestedKeys) {
        return { success: false, error: `Proposer inventory does not have enough capacity to receive requested items.` };
      }

      // Check receiver empty slots count (receiver will receive offeredItems)
      const receiverEmptySlots = receiverFull.slots.filter(s => s.item === null).length;
      const uniqueOfferedKeys = new Set(offeredItems.map(i => i.key)).size;
      if (receiverEmptySlots < uniqueOfferedKeys) {
        return { success: false, error: `Your inventory does not have enough capacity to receive trade items.` };
      }

      // 5. Swap Credits
      // Deduct from receiver, add offeredCredits to receiver
      const receiverNewWallet = receiverFull.wallet - requestedCredits + offeredCredits;
      const recWalletRes = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${receiverDocId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { wallet: receiverNewWallet } }),
      });
      if (!recWalletRes.ok) throw new Error("Failed to modify receiver wallet balance.");

      // Add to proposer (proposer has already had offeredCredits deducted!)
      const currentProposerWallet = Number(proposer.wallet ?? 0);
      const proposerNewWallet = currentProposerWallet + requestedCredits;
      const propWalletRes = await fetch(`${STRAPI_BASE_URL}/api/player-profiles/${proposerDocId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { wallet: proposerNewWallet } }),
      });
      if (!propWalletRes.ok) throw new Error("Failed to modify proposer wallet balance.");

      // 6. Swap Items
      // Deduct requested items from receiver inventory
      for (const req of requestedItems) {
        await removeItemsFromInventory(receiverDocId, req.key, req.quantity);
      }

      // Add offered items to receiver inventory
      for (const offered of offeredItems) {
        await addItemsToInventory(receiverDocId, offered.key, offered.quantity, receiverFull.capacity);
      }

      // Add requested items to proposer inventory
      for (const req of requestedItems) {
        await addItemsToInventory(proposerDocId, req.key, req.quantity, proposerFull.capacity);
      }

      // 7. Update status to ACCEPTED
      const statusUpdateRes = await fetch(`${STRAPI_BASE_URL}/api/trade-proposals/${proposalId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ data: { status: "ACCEPTED" } }),
      });
      if (!statusUpdateRes.ok) throw new Error("Failed to accept trade proposal.");

      // 8. Log ledger records for both players under P2P_TRADE
      await logTransaction(
        proposerDocId,
        requestedCredits - offeredCredits,
        "TRADE_P2P",
        `Completed trade with ${receiverUsername} (Received $${requestedCredits} credits, gave offered items)`
      );

      await logTransaction(
        receiverDocId,
        offeredCredits - requestedCredits,
        "TRADE_P2P",
        `Completed trade with ${proposerUsername} (Received $${offeredCredits} credits, gave requested items)`
      );

      // 9. Dispatch mail notifications
      const propMailSubject = `Trade Completed: ${receiverUsername}`;
      const propMailBody = `Your trade proposal to ${receiverUsername} has been ACCEPTED and completed successfully.\n\n` +
        `- Gained: $${requestedCredits} credits + ${requestedItems.map(i => `${i.quantity}x ${i.key}`).join(", ") || "No Items"}\n` +
        `- Swapped out: $${offeredCredits} credits + ${offeredItems.map(i => `${i.quantity}x ${i.key}`).join(", ") || "No Items"}`;
      await sendSystemMail(proposerDocId, propMailSubject, propMailBody, "SYSTEM");

      const recMailSubject = `Trade Completed: ${proposerUsername}`;
      const recMailBody = `You successfully completed the trade with ${proposerUsername}.\n\n` +
        `- Gained: $${offeredCredits} credits + ${offeredItems.map(i => `${i.quantity}x ${i.key}`).join(", ") || "No Items"}\n` +
        `- Swapped out: $${requestedCredits} credits + ${requestedItems.map(i => `${i.quantity}x ${i.key}`).join(", ") || "No Items"}`;
      await sendSystemMail(receiverDocId, recMailSubject, recMailBody, "SYSTEM");

      notifyUsers([proposerUsername, receiverUsername], "portfolio_updated");
      notifyUsers([proposerUsername, receiverUsername], "mail_updated");

      return { success: true };
    }

    return { success: false, error: "Invalid resolution action." };
  } catch (error: any) {
    console.error("[tradeService] Error resolving trade:", error);
    return { success: false, error: error.message || "An unexpected error occurred during trade resolution." };
  }
}

// 3. List active proposals
export async function getPlayerTradeProposals(username: string): Promise<{
  incoming: TradeProposalDTO[];
  outgoing: TradeProposalDTO[];
}> {
  const headers = getStrapiServiceHeaders();

  // A. Fetch current user
  const userUrl = new URL(`${STRAPI_BASE_URL}/api/users`);
  userUrl.searchParams.set("filters[username][$eq]", username);
  const userRes = await fetch(userUrl, { headers, cache: "no-store" });
  if (!userRes.ok) throw new Error("User lookup failed.");
  const users = await userRes.json();
  const user = users?.[0];
  if (!user) throw new Error("User not found.");

  const authUserId = user.id;

  // B. Fetch Player Profile using authUserId
  const profileUrl = new URL(`${STRAPI_BASE_URL}/api/player-profiles`);
  profileUrl.searchParams.set("filters[authUserId][$eq]", String(authUserId));
  profileUrl.searchParams.set("pagination[limit]", "1");
  const profileRes = await fetch(profileUrl, { headers, cache: "no-store" });
  const profileJson = await profileRes.json();
  const profile = profileJson.data?.[0];
  if (!profile) throw new Error("Player profile not found.");

  const profileDocId = profile.documentId ?? String(profile.id);

  // C. Fetch Incoming trade proposals (where receiver is me)
  const incomingUrl = new URL(`${STRAPI_BASE_URL}/api/trade-proposals`);
  incomingUrl.searchParams.set("filters[receiver][documentId][$eq]", profileDocId);
  incomingUrl.searchParams.set("populate[0]", "proposer");
  incomingUrl.searchParams.set("populate[1]", "receiver");
  incomingUrl.searchParams.set("sort", "createdAt:desc");
  incomingUrl.searchParams.set("pagination[limit]", "100");

  const incomingRes = await fetch(incomingUrl, { headers, cache: "no-store" });
  const incomingJson = await incomingRes.json();
  const rawIncoming = incomingJson.data ?? [];

  // D. Fetch Outgoing trade proposals (where proposer is me)
  const outgoingUrl = new URL(`${STRAPI_BASE_URL}/api/trade-proposals`);
  outgoingUrl.searchParams.set("filters[proposer][documentId][$eq]", profileDocId);
  outgoingUrl.searchParams.set("populate[0]", "proposer");
  outgoingUrl.searchParams.set("populate[1]", "receiver");
  outgoingUrl.searchParams.set("sort", "createdAt:desc");
  outgoingUrl.searchParams.set("pagination[limit]", "100");

  const outgoingRes = await fetch(outgoingUrl, { headers, cache: "no-store" });
  const outgoingJson = await outgoingRes.json();
  const rawOutgoing = outgoingJson.data ?? [];

  const mapProposal = (raw: any): TradeProposalDTO => ({
    documentId: raw.documentId ?? String(raw.id),
    id: raw.id,
    proposerName: raw.proposer?.displayName || "Unknown",
    receiverName: raw.receiver?.displayName || "Unknown",
    offeredCredits: Number(raw.offeredCredits ?? 0),
    requestedCredits: Number(raw.requestedCredits ?? 0),
    offeredItems: raw.offeredItems ?? [],
    requestedItems: raw.requestedItems ?? [],
    status: raw.status || "PENDING",
    createdAt: raw.createdAt || new Date().toISOString(),
  });

  return {
    incoming: rawIncoming.map(mapProposal),
    outgoing: rawOutgoing.map(mapProposal),
  };
}
