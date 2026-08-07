import prisma from "@/lib/prisma";
import { getUserFromToken, isAdminRole } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const authorization = req.headers.get("authorization");
  const admin = authorization?.startsWith("Bearer ") ? await getUserFromToken(authorization.slice(7)) : null;
  if (!admin || !isAdminRole(admin.role)) return NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const trendStart = new Date(today);
  trendStart.setDate(trendStart.getDate() - 29);

  const [usersTotal, usersToday, usersMonth, completedRegistrations, applicationsTotal, applicationsPending, applicationsApproved, applicationsRejected, enrollmentsTotal, applicants, paymentGroups, recentApplications, trendUsers, trendApplications] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { registrationCompleted: true } }),
    prisma.courseApplication.count(),
    prisma.courseApplication.count({ where: { status: { in: ["pending", "pending_payment"] } } }),
    prisma.courseApplication.count({ where: { status: "approved" } }),
    prisma.courseApplication.count({ where: { status: "rejected" } }),
    prisma.enrollment.count(),
    prisma.courseApplication.groupBy({ by: ["userId"] }),
    prisma.paymentOrder.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountTomans: true } }),
    prisma.courseApplication.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: { id: true, fullName: true, status: true, createdAt: true, finalAmountTomans: true, course: { select: { title: true } } },
    }),
    prisma.user.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
    prisma.courseApplication.findMany({ where: { createdAt: { gte: trendStart } }, select: { createdAt: true } }),
  ]);

  const payments = paymentGroups.reduce<Record<string, { count: number; amount: number }>>((result, item) => {
    result[item.status] = { count: item._count._all, amount: item._sum.amountTomans || 0 };
    return result;
  }, {});
  const trend = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(date.getDate() + index);
    const key = dayKey(date);
    return {
      date: key,
      users: trendUsers.filter((item) => dayKey(item.createdAt) === key).length,
      applications: trendApplications.filter((item) => dayKey(item.createdAt) === key).length,
    };
  });

  return NextResponse.json({
    summary: { usersTotal, usersToday, usersMonth, completedRegistrations, applicationsTotal, applicationsPending, applicationsApproved, applicationsRejected, enrollmentTotal: enrollmentsTotal, uniqueApplicants: applicants.length, paidOrders: payments.paid?.count || 0, paidAmountTomans: payments.paid?.amount || 0, pendingPayments: (payments.pending?.count || 0) + (payments.awaiting_receipt?.count || 0) + (payments.under_review?.count || 0) },
    trend,
    recentApplications,
  });
}
