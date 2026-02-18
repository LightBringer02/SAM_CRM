import React from "react";
import { useTheme } from "../theme";
import NotificationPane from "./NotificationPane";

export default function RightPane() {
  const { dark, currentTheme } = useTheme();

  return (
    <div 
      className="fixed top-16 right-2 w-12 flex flex-col items-center py-3 gap-3 backdrop-blur-xl transition-all duration-300 rounded-xl"
      style={{
        backgroundColor: dark 
          ? 'rgba(26, 26, 58, 0.65)' 
          : 'rgba(248, 250, 252, 0.65)',
        border: `1px solid ${currentTheme?.border || (dark ? 'rgba(45, 45, 90, 0.5)' : 'rgba(226, 232, 240, 0.5)')}`,
        zIndex: 100
      }}
    >
      {/* Notification Button */}
      <NotificationPane />
    </div>
  );
}
