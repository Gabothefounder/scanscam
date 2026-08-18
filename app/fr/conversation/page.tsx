import type { Metadata } from "next";
import ConversationLanding from "@/components/ConversationLanding";
import { CONVERSATION_COPY } from "@/lib/conversation/copy";

export const metadata: Metadata = {
  title: CONVERSATION_COPY.fr.metaTitle,
  description: CONVERSATION_COPY.fr.metaDescription,
};

export default function ConversationFrPage() {
  return <ConversationLanding lang="fr" />;
}
