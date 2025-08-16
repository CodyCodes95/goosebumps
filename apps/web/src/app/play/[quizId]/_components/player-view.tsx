"use client";

import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@goosebumps/backend";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { LoaderContainer } from "../../../../components/loader";
import {
  Users,
  Clock,
  Play,
  Zap,
  Send,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { useEffect, useState, useCallback, useMemo } from "react";
import usePresence from "@convex-dev/presence/react";
import { toast } from "sonner";
import { GamePlayerView } from "../../../../components/game/player-view";

type PlayerViewProps = {
  quizId: string;
};

export function PlayerView({ quizId }: PlayerViewProps) {
  // Use the new gamey player view
  return <GamePlayerView quizId={quizId} />;
}
