"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { workoutPlan, type Exercise } from "@/lib/workout-data";
import { WorkoutCard } from "@/components/workout-card";
import { GymQrSheet } from "@/components/gym-qr-sheet";
import {
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type WorkoutProgress = {
  [exerciseName: string]: {
    weight: string;
    isCompleted: boolean;
  };
};

export type ExerciseHistory = {
  [exerciseName: string]: { date: string; weight: string }[];
};

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [workoutProgress, setWorkoutProgress] = useState<WorkoutProgress>({});
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistory>({});

  const selectedDayName = useMemo(
    () => format(selectedDate, "EEEE"),
    [selectedDate]
  );
  const dailyStorageKey = useMemo(
    () => `workout-progress-${format(selectedDate, "yyyy-MM-dd")}`,
    [selectedDate]
  );
  const historyStorageKey = "workout-history";

  useEffect(() => {
    const orientation = window.screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'portrait') => Promise<void>;
    };

    // Attempt to lock screen orientation to portrait
    if (typeof orientation.lock === "function") {
      orientation.lock("portrait").catch(() => {
        // Silently ignore errors, as this is a progressive enhancement
      });
    }

    try {
      const savedHistory = localStorage.getItem(historyStorageKey);
      const history: ExerciseHistory = savedHistory ? JSON.parse(savedHistory) : {};
      setExerciseHistory(history);

      const savedProgress = localStorage.getItem(dailyStorageKey);
      if (savedProgress) {
        setWorkoutProgress(JSON.parse(savedProgress));
      } else {
        // No saved progress for this day, pre-fill weight from most recent history entry
        const currentDay = workoutPlan.find((d) => d.day === selectedDayName);
        const preFilled: WorkoutProgress = {};
        currentDay?.exercises.forEach((exercise) => {
          preFilled[exercise.name] = {
            weight: history[exercise.name]?.[0]?.weight ?? "",
            isCompleted: false,
          };
        });
        setWorkoutProgress(preFilled);
      }
    } catch (error) {
      console.error("Failed to read from localStorage", error);
      setWorkoutProgress({});
      setExerciseHistory({});
    }
  }, [dailyStorageKey]);

  const updateHistory = useCallback((exerciseName: string, weight: string) => {
    const today = format(new Date(), "yyyy-MM-dd");

    setExerciseHistory((currentHistory) => {
      const newHistory = { ...currentHistory };
      const exerciseLog = newHistory[exerciseName] || [];

      const existingEntryIndex = exerciseLog.findIndex(
        (entry) => entry.date === today
      );

      if (weight) {
        if (existingEntryIndex > -1) {
          // Update today's entry if it exists and weight is not empty
          exerciseLog[existingEntryIndex] = { date: today, weight };
        } else {
          // Add a new entry for today
          exerciseLog.push({ date: today, weight });
        }
      } else if (existingEntryIndex > -1) {
        // Remove today's entry if weight is cleared
        exerciseLog.splice(existingEntryIndex, 1);
      }

      newHistory[exerciseName] = exerciseLog.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      try {
        localStorage.setItem(historyStorageKey, JSON.stringify(newHistory));
      } catch (error) {
        console.error("Failed to write history to localStorage", error);
      }

      return newHistory;
    });
  }, []);

  const handleProgressChange = useCallback(
    (
      exerciseName: string,
      newProgress: { weight?: string; isCompleted?: boolean }
    ) => {
      setWorkoutProgress((currentProgress) => {
        const existingProgress = currentProgress[exerciseName] || {
          weight: "",
          isCompleted: false,
        };
        const updatedExerciseProgress = { ...existingProgress, ...newProgress };

        const updatedDailyProgress = {
          ...currentProgress,
          [exerciseName]: updatedExerciseProgress,
        };

        try {
          localStorage.setItem(
            dailyStorageKey,
            JSON.stringify(updatedDailyProgress)
          );
        } catch (error) {
          console.error(
            "Failed to write daily progress to localStorage",
            error
          );
        }

        // If exercise is marked as complete, update history
        if (
          newProgress.isCompleted === true &&
          updatedExerciseProgress.weight
        ) {
          updateHistory(exerciseName, updatedExerciseProgress.weight);
        }

        // If weight changes, update history if it's already completed today
        if (
          newProgress.weight !== undefined &&
          updatedExerciseProgress.isCompleted
        ) {
          updateHistory(exerciseName, newProgress.weight);
        }

        return updatedDailyProgress;
      });
    },
    [dailyStorageKey, updateHistory]
  );

  const currentWorkoutDay = useMemo(() => {
    return workoutPlan.find((day) => day.day === selectedDayName);
  }, [selectedDayName]);

  const handleDayChange = (direction: "prev" | "next") => {
    setSelectedDate((currentDate) => {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + (direction === "prev" ? -1 : 1));
      return newDate;
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsCalendarOpen(false);
    }
  };

  return (
    <main className="h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain">
      <div className="container mx-auto px-4 py-8 pb-24">
        <header className="flex items-center mb-8">
          <div className="w-14 shrink-0" />
          <h1 className="flex-1 text-4xl font-headline font-bold flex items-center justify-center gap-3 text-primary">
            <Dumbbell className="size-10" />
            LiftLogr
          </h1>
          <GymQrSheet />
        </header>

        <div className="flex justify-center items-center gap-4 mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDayChange("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous day</span>
          </Button>
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-48 justify-start text-left font-normal", {
                  "font-bold":
                    selectedDate.toDateString() === new Date().toDateString(),
                })}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
              />
              <Button
                onClick={() => handleDateSelect(new Date())}
                className="w-full rounded-t-none"
              >
                Today
              </Button>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleDayChange("next")}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next day</span>
          </Button>
        </div>

        <div>
          {currentWorkoutDay && currentWorkoutDay.exercises.length > 0 ? (
            <div className="grid gap-6 mt-6 md:grid-cols-2 lg:grid-cols-3">
              {currentWorkoutDay.exercises.map((exercise, index) => (
                <WorkoutCard
                  key={`${currentWorkoutDay.day}-${exercise.name}-${index}`}
                  exercise={exercise}
                  progress={
                    workoutProgress[exercise.name] || {
                      weight: "",
                      isCompleted: false,
                    }
                  }
                  onProgressChange={handleProgressChange}
                  history={exerciseHistory[exercise.name] || []}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <h2 className="text-2xl font-semibold mb-2">{selectedDayName}</h2>
              <p className="text-lg text-muted-foreground">
                Rest Day! Take time to recover.
              </p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
