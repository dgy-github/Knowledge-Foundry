import { startSystemEvents } from "./lib/logs.js";
import { initPreviewDrawer } from "./lib/preview.js";
import { initChat } from "./features/chat.js";
import { initDashboard, loadDashboard } from "./features/dashboard.js";
import { initGraph } from "./features/graph.js";
import { initViews } from "./features/views.js";

initPreviewDrawer();
startSystemEvents();
initGraph();
initViews();
initDashboard();
initChat();

window.loadDashboard = loadDashboard;
