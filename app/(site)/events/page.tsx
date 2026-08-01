"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
  Users,
  ImageIcon,
} from "lucide-react";

interface EventItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  startDate: string;
  endDate?: string;
  location?: string;
  imageUrl?: string;
  published: boolean;
  instructorCount: number;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch("/api/events");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const published = (data.events || []).filter(
          (e: EventItem) => e.published
        );
        setEvents(published);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen pt-32 pb-16">
      <div className="max-w-[1280px] mx-auto px-5 md:px-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-primary mb-2">رویدادها</h1>
          <p className="text-outline">
            رویدادها، همایش‌ها و کارگاه‌های پیش رو
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-secondary" />
          </div>
        ) : error ? (
          <div className="flex justify-center py-20">
            <div className="text-center">
              <AlertCircle size={40} className="text-outline mx-auto mb-3" />
              <p className="text-outline text-lg">خطا در بارگذاری رویدادها</p>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-outline-variant/30">
            <Calendar size={48} className="text-outline-variant mx-auto mb-3" />
            <p className="text-outline text-lg">رویدادی یافت نشد</p>
            <p className="text-outline-variant text-sm mt-1">به زودی...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-outline-variant/30"
              >
                <div className="relative aspect-[9/16] overflow-hidden">
                  {event.imageUrl ? (
                    <div
                      className="w-full h-full bg-cover bg-center group-hover:scale-110 transition-transform duration-700"
                      style={{ backgroundImage: `url(${event.imageUrl})` }}
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-variant flex items-center justify-center">
                      <ImageIcon size={32} className="text-outline-variant" />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-primary text-base mb-3 line-clamp-2 leading-relaxed">
                    {event.title}
                  </h3>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-outline text-xs">
                      <Calendar size={14} />
                      <span>
                        {formatDate(event.startDate)}
                        {event.endDate &&
                          ` - ${formatDate(event.endDate)}`}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2 text-outline text-xs">
                        <MapPin size={14} />
                        <span>{event.location}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 border-t border-outline-variant/20 pt-3 text-xs text-outline">
                    <div className="flex items-center gap-1">
                      <Users size={14} />
                      <span>{event.instructorCount} استاد</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
