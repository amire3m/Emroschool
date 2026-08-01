"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import CopyLinkButton from "@/components/ui/copy-link-button";
import { useInitialData } from "@/components/seo/initial-data-provider";
import {
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
  Users,
  ChevronRight,
  ImageIcon,
  User,
} from "lucide-react";

interface InstructorUser {
  id: string;
  name: string;
  avatar?: string;
  email: string;
}

interface InstructorInfo {
  id: string;
  name?: string | null;
  avatar?: string | null;
  bio?: string;
  expertise?: string;
  user?: InstructorUser | null;
}

interface EventInstructor {
  instructor: InstructorInfo;
}

interface EventDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  startDate: string;
  endDate?: string;
  location?: string;
  imageUrl?: string;
  published: boolean;
  instructors: EventInstructor[];
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const initialEvent = useInitialData<EventDetail>("event");
  const [event, setEvent] = useState<EventDetail | null>(initialEvent);
  const [loading, setLoading] = useState(!initialEvent);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch(`/api/events/${slug}`);
        if (!res.ok) {
          if (res.status === 404) setNotFound(true);
          return;
        }
        const data = await res.json();
        setEvent(data.event);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center pt-24">
        <Loader2 size={32} className="animate-spin text-secondary" />
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center pt-24">
        <AlertCircle size={48} className="text-outline mb-4" />
        <p className="text-outline text-lg mb-4">رویداد مورد نظر یافت نشد</p>
        <button
          onClick={() => router.push("/events")}
          className="bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-container transition-all"
        >
          بازگشت به رویدادها
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1280px] mx-auto px-5 md:px-8">
        <button
          onClick={() => router.push("/events")}
          className="flex items-center gap-1 text-outline hover:text-primary transition-colors mb-6 text-sm"
        >
          <ChevronRight size={16} />
          بازگشت به رویدادها
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="relative aspect-video rounded-2xl overflow-hidden mb-6">
              {event.imageUrl ? (
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${event.imageUrl})` }}
                />
              ) : (
                <div className="w-full h-full bg-surface-variant flex items-center justify-center">
                  <ImageIcon size={48} className="text-outline-variant" />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h1 className="text-2xl md:text-3xl font-bold text-primary">{event.title}</h1><CopyLinkButton path={`/events/${event.slug}`} /></div>

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center gap-2 text-outline text-sm">
                <Calendar size={16} />
                <span>
                  {formatDate(event.startDate)}
                  {event.endDate && ` - ${formatDate(event.endDate)}`}
                </span>
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-outline text-sm">
                  <MapPin size={16} />
                  <span>{event.location}</span>
                </div>
              )}
            </div>

            <div className="prose prose-sm max-w-none text-on-background leading-relaxed whitespace-pre-line mb-10">
              {event.description}
            </div>

            {event.instructors.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                  <Users size={20} />
                  اساتید
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {event.instructors.map((ei) => (
                    <div
                      key={ei.instructor.id}
                      className="flex items-center gap-4 p-4 bg-white rounded-xl border border-outline-variant/30"
                    >
                      {ei.instructor.avatar || ei.instructor.user?.avatar ? (
                        <img
                          src={ei.instructor.avatar || ei.instructor.user?.avatar || ""}
                          alt={ei.instructor.name || ei.instructor.user?.name || "استاد رویداد"}
                          className="w-14 h-14 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-surface-variant flex items-center justify-center shrink-0">
                          <User size={24} className="text-outline" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-primary">
                          {ei.instructor.name || ei.instructor.user?.name || "استاد رویداد"}
                        </p>
                        {ei.instructor.expertise && (
                          <p className="text-secondary text-xs">
                            {ei.instructor.expertise}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="bg-white rounded-2xl shadow-lg border border-outline-variant/30 p-6 sticky top-28">
              <h3 className="font-bold text-primary mb-4">خلاصه رویداد</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-fixed/30 flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs text-outline">تاریخ شروع</p>
                    <p className="text-sm font-bold text-primary">
                      {formatDate(event.startDate)}
                    </p>
                  </div>
                </div>
                {event.endDate && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary-fixed/30 flex items-center justify-center shrink-0">
                      <Calendar size={18} className="text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs text-outline">تاریخ پایان</p>
                      <p className="text-sm font-bold text-primary">
                        {formatDate(event.endDate)}
                      </p>
                    </div>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary-fixed/30 flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-secondary" />
                    </div>
                    <div>
                      <p className="text-xs text-outline">مکان</p>
                      <p className="text-sm font-bold text-primary">
                        {event.location}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary-fixed/30 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-secondary" />
                  </div>
                  <div>
                    <p className="text-xs text-outline">اساتیـد</p>
                    <p className="text-sm font-bold text-primary">
                      {event.instructors.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
