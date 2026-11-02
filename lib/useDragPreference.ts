"use client";

import { useEffect, useState } from "react";

const TOUCH_QUERY = "(pointer: coarse), (max-width: 720px)";

// Drag-and-drop is on by default with a mouse, but fiddly on touch screens,
// so there it starts off and the user can switch it on explicitly.
export function useDragPreference() {
  const [isTouch, setIsTouch] = useState(false);
  const [dragOn, setDragOn] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(TOUCH_QUERY);
    const update = () => setIsTouch(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return { isTouch, dragEnabled: !isTouch || dragOn, dragOn, setDragOn };
}
