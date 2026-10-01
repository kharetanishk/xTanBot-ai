import { useEffect, useState } from "react";
import { router } from "expo-router";
import { LiveKitRoom, RoomAudioRenderer, StartAudio, useLocalParticipant, useTrackVolume, useVoiceAssistant } from "@livekit/components-react";
import type { LocalAudioTrack } from "livekit-client";
import VoiceStage, { VoiceStageMessage } from "./VoiceStage";
import { apiClient, getApiError } from "../../api/client";
import { hrefTab } from "../../navigation/href";

// Web version — browsers have WebRTC built in, so this uses LiveKit's web SDK.
// iOS/Android use VoiceScreen.native.tsx (@livekit/react-native). Both render VoiceStage.

type VoiceSession = { url: string; token: string; roomName: string };

const close = () => (router.canGoBack() ? router.back() : router.replace(hrefTab("chat")));

export default function VoiceScreen() {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .post<VoiceSession>("/voice/session")
      .then((res) => !cancelled && setSession(res.data))
      .catch((err) => !cancelled && setError(getApiError(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error || !session) return <VoiceStageMessage message={error ?? undefined} onClose={close} />;

  return (
    <LiveKitRoom serverUrl={session.url} token={session.token} connect audio video={false} onError={(e) => setError(e.message)} onDisconnected={close} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Plays the agent's voice; StartAudio shows a button if the browser blocks autoplay. */}
      <RoomAudioRenderer />
      <StartAudio label="Click to enable audio" />
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
