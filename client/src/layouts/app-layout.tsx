import Navbar from "@/components/navbar";
import SideBar from "@/components/sidebar";
import UploadActivity from "@/components/upload-activity";
import AiPanel from "@/components/ai-panel";
import { NoticesAnnouncementBar } from "@/components/notices/notices-panel";
import { Outlet } from "react-router-dom";

const AppLayout = () => {
  return (
    <>
      <div className="w-full min-h-screen pb-10">
        <NoticesAnnouncementBar />
        <Navbar />
        <main className="mx-auto flex min-w-0 max-w-7xl grow flex-col sm:flex-row sm:py-6">
          <SideBar />
          <div
            style={{ scrollbarWidth: "none" }}
            className="flex w-screen grow flex-col overflow-y-auto px-4 sm:w-full sm:p-6"
          >
            <Outlet />
          </div>
        </main>
        <UploadActivity />
        <AiPanel />
      </div>
    </>
  );
};

export default AppLayout;
