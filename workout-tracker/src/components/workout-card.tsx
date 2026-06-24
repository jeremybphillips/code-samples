"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSwipe } from "@/hooks/use-swipe";
import type { Exercise } from "@/lib/workout-data";
import type { ExerciseHistory } from "@/app/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeftRight, Video, History } from "lucide-react";
import { format, subMonths } from "date-fns";
import { VideoPlayer } from "@/components/video-player";

type WorkoutCardProps = {
  exercise: Exercise;
  progress: {
    weight: string;
    isCompleted: boolean;
  };
  onProgressChange: (
    exerciseName: string,
    newProgress: { weight?: string; isCompleted?: boolean }
  ) => void;
  history: ExerciseHistory[string];
};

export function WorkoutCard({
  exercise,
  progress,
  onProgressChange,
  history,
}: WorkoutCardProps) {
  const { name } = exercise;
  const { weight, isCompleted } = progress;
  const [isFlipped, setIsFlipped] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => setIsFlipped(true),
    onSwipeRight: () => setIsFlipped(false),
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleCheckboxChange = (checked: boolean) => {
    onProgressChange(name, { isCompleted: checked });
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onProgressChange(name, { weight: e.target.value });
  };

  const videoPath = `/videos/${exercise.name}.mp4`;
  const thumbnailPath = `/videos/thumbnails/${exercise.name}.png`;

  const twoMonthsAgo = subMonths(new Date(), 2);
  const recentHistory = history?.filter(
    (entry) => new Date(entry.date) >= twoMonthsAgo
  ) ?? [];

  return (
    <Card
      className={cn(
        "touch-pan-y select-none transition-colors duration-300 overflow-hidden",
        isCompleted ? "bg-primary/10 border-primary/50" : "bg-card"
      )}
      {...swipeHandlers}
    >
      <div
        className={cn(
          "flex w-[200%] transition-transform duration-300 ease-in-out",
          isFlipped ? "-translate-x-1/2" : "translate-x-0"
        )}
      >
        {/* ── Front Panel ── */}
        <div className="w-1/2 flex">
          <div className="flex items-center gap-3 px-3 py-3 flex-1">
            <img
              src={thumbnailPath}
              alt={name}
              className="h-24 w-24 rounded-md object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  "font-semibold text-lg leading-tight",
                  isCompleted && "line-through text-muted-foreground"
                )}
              >
                {name}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {exercise.sets} sets · {exercise.reps} reps · {exercise.rest}
              </p>
            </div>
          </div>
          <button
            className="w-10 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            onClick={() => setIsFlipped(true)}
            aria-label="Open tracking panel"
          >
            <ArrowLeftRight className="size-4" />
          </button>
        </div>

        {/* ── Back Panel ── */}
        <div className="w-1/2 flex">
          <div className="flex flex-col gap-8 px-3 py-3 flex-1 min-w-0">
            {/* Row 1: Weight input */}
            <div>
              <Label htmlFor={`weight-${name}`} className="sr-only">
                Weight (lbs) / Reps
              </Label>
              <Input
                id={`weight-${name}`}
                type="number"
                inputMode="decimal"
                placeholder="Weight (lbs) / Reps"
                value={weight}
                onChange={handleWeightChange}
                className="h-8 w-full text-base"
                disabled={isCompleted}
              />
            </div>

            {/* Row 2: History + Video (centered) + Done */}
            <div className="flex items-center gap-2">
              <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-7 px-2 text-sm font-medium gap-1.5"
                    aria-label={`View history for ${name}`}
                    disabled={isCompleted}
                  >
                    <History className="size-3.5 shrink-0" />
                    History
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[380px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <History className="size-4" />
                      {name}
                    </DialogTitle>
                  </DialogHeader>
                  {recentHistory.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {recentHistory.map((entry, index) => (
                        <li
                          key={index}
                          className="flex justify-between items-center py-2 border-b last:border-none"
                        >
                          <span className="text-muted-foreground">
                            {format(new Date(entry.date), "MMM dd, yyyy")}
                          </span>
                          <span className="font-semibold">
                            {entry.weight} lbs
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No history in the last 2 months.
                    </p>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-red-600 hover:text-red-700"
                    aria-label={`Watch video for ${name}`}
                  >
                    <Video className="size-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>{name}</DialogTitle>
                  </DialogHeader>
                  <VideoPlayer src={videoPath} title={name} autoPlay={true} />
                </DialogContent>
              </Dialog>

              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <Checkbox
                  id={`complete-${name}`}
                  checked={isCompleted}
                  onCheckedChange={handleCheckboxChange}
                  className="size-5"
                />
                <Label
                  htmlFor={`complete-${name}`}
                  className={cn(
                    "text-sm font-medium cursor-pointer transition-colors",
                    isCompleted && "line-through text-muted-foreground"
                  )}
                >
                  Done
                </Label>
              </div>
            </div>
          </div>
          <button
            className="w-10 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            onClick={() => setIsFlipped(false)}
            aria-label="Back to exercise info"
          >
            <ArrowLeftRight className="size-4" />
          </button>
        </div>
      </div>
    </Card>
  );
}
