import { useEffect, useState } from "react";
import { router } from "expo-router";
import {
  AudioSession,
  LiveKitRoom,
  registerGlobals,
  useLocalParticipant,
  useTrackVolume,
  useVoiceAssistant,
} from "@livekit/react-native";
import type { LocalAudioTrack } from "livekit-client";
import VoiceStage, { VoiceStageMessage } from "./VoiceStage";
import { apiClient, getApiError } from "../../api/client";
import { hrefTab } from "../../navigation/href";

registerGlobals();

type VoiceSession = { url: string; token: string; roomName: string };

const close = () => (router.canGoBack() ? router.back() : router.replace(hrefTab("chat")));

export default function VoiceScreen() {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await AudioSession.startAudioSession();
        const res = await apiClient.post<VoiceSession>("/voice/session");
        if (!cancelled) setSession(res.data);
      } catch (err) {
        if (!cancelled) setError(getApiError(err));
      }
    })();
    return () => {
      cancelled = true;
      AudioSession.stopAudioSession();
    };
  }, []);

  if (error || !session) return <VoiceStageMessage message={error ?? undefined} onClose={close} />;

  return (
    <LiveKitRoom serverUrl={session.url} token={session.token} connect audio video={false} onError={(e) => setError(e.message)} onDisconnected={close}>
      <Assistant />
    </LiveKitRoom>
  );
}

function Assistant() {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled, microphoneTrack } = useLocalParticipant();
  const agentLevel = useTrackVolume(audioTrack);
  const micLevel = useTrackVolume(microphoneTrack?.track as LocalAudioTrack | undefined);
  return (
    <VoiceStage
      state={state}
      agentLevel={agentLevel}
      micLevel={micLevel}
      caption={agentTranscriptions.at(-1)?.text ?? ""}
      captionId={agentTranscriptions.at(-1)?.id}
      muted={!isMicrophoneEnabled}
      onToggleMute={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
      onEnd={close}
      onChat={() => router.replace(hrefTab("chat"))}
    />
  );
}
