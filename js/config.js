'use strict';

/* Planner X — Settings and constants: levels, points, categories, names. */

const STORE_KEY = 'plannerx.v1';

const LEVELS = [
  // need = total points to reach the rank; r1/r2 = the badge's metal gradient
  { name: 'Beginner',    need: 0,    icon: '🌱', r1: '#7CB342', r2: '#43A047' },
  { name: 'Bronze',      need: 150,  icon: '🥉', r1: '#D08A4E', r2: '#8C4A22' },
  { name: 'Silver',      need: 400,  icon: '🥈', r1: '#B8C2CF', r2: '#6E7B8E' },
  { name: 'Gold',        need: 800,  icon: '🥇', r1: '#F6C744', r2: '#C48A0B' },
  { name: 'Platinum',    need: 1400, icon: '💠', r1: '#5FD3E6', r2: '#2E86A8' },
  { name: 'Diamond',     need: 2200, icon: '💎', r1: '#6EA8FF', r2: '#8A5CF6' },
  { name: 'Master',      need: 3300, icon: '🔮', r1: '#B06AF2', r2: '#6C2BD9' },
  { name: 'Grandmaster', need: 4700, icon: '👑', r1: '#F25C7A', r2: '#B4235A' },
  { name: 'Champion',    need: 6500, icon: '🏆', r1: '#FF9A3D', r2: '#E2482D' },
  { name: 'Legend',      need: 9000, icon: '🌟', r1: '#FF6FD8', r2: '#3813C2' },
];
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

// Small rewards for planning (adding things), capped per day so they can't be farmed.
const ADD_PTS = { priority: 2, habit: 3, goal: 3, log: 2, note: 1 };
const ADD_CAP = 20;

// Points for each kind of plan block. Tasks use IMPORTANCE_PTS instead.
// commit = total for a full workday, split across its parts
const POINTS = { routine: 5, meal: 5, break: 2, commit: 40, exercise: 15, review: 10, winddown: 10, habit: 10, task: 0, free: 0 };
const IMPORTANCE_PTS = { high: 30, medium: 20, low: 10 };
const GOAL_PTS = { W: 40, M: 80, Y: 200 };

// The parts of the day every plan is built around. Editable in Settings (see routineOf in planner.js).
// Only the keys in ROUTINE_KEYS are used; the rest stay off (the planner still reads their times).
const DEFAULT_ROUTINE = {
  wake:      { label: 'Wake up',         on: true,  dur: 15, title: 'Wake up, drink a glass of water, open the curtains' },
  morning:   { label: 'Morning routine', on: false, dur: 30, title: 'Morning routine — shower, get dressed, make the bed' },
  breakfast: { label: 'Breakfast',       on: false, dur: 20, title: 'Breakfast' },
  lunch:     { label: 'Lunch',           on: false, dur: 40, title: 'Lunch — step away from the screen', time: '12:30' },
  dinner:    { label: 'Dinner',          on: false, dur: 40, title: 'Dinner', time: '19:00' },
  exercise:  { label: 'Exercise',        on: true,  dur: 30, title: 'Move your body — walk, workout or stretch' },
  review:    { label: 'Evening review',  on: false, dur: 10, title: "Review today & check tomorrow's plan" },
  winddown:  { label: 'Wind down',       on: false, dur: 45, title: 'Wind down — no screens, read or stretch' },
};
// the routine blocks a plan can include (and that Settings shows)
const ROUTINE_KEYS = ['wake', 'exercise'];

const CATEGORIES = {
  work:     { label: 'Work',     icon: '💼' },
  study:    { label: 'Study',    icon: '📚' },
  health:   { label: 'Health',   icon: '💪' },
  personal: { label: 'Personal', icon: '🌱' },
  home:     { label: 'Home',     icon: '🏠' },
  social:   { label: 'Social',   icon: '👥' },
  finance:  { label: 'Finance',  icon: '💰' },
};

const TYPE_LABEL = {
  routine: 'Routine', meal: 'Meal', task: 'Priority', anytime: 'Anytime', habit: 'Daily goal', break: 'Break', commit: 'Fixed',
  exercise: 'Exercise', review: 'Review', winddown: 'Wind down', free: 'Free',
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
