"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { getCookie } from "@/lib/cookie";

const labels: Record<string, string> = { id: "شناسه", status: "وضعیت", fullName: "نام کامل", name: "نام", email: "ایمیل", phone: "موبایل", nationalCode: "کد ملی", course: "دوره", title: "عنوان", orderNumber: "شماره سفارش", amountTomans: "مبلغ (تومان)", amountRials: "مبلغ (ریال)", method: "روش پرداخت", createdAt: "تاریخ ایجاد", updatedAt: "تاریخ بروزرسانی", paidAt: "تاریخ پرداخت", province: "استان", city: "شهر", address: "نشانی", postalCode: "کدپستی", educationLevel: "مقطع تحصیلی", educationField: "رشته تحصیلی", reason: "دلیل انتخاب", workHistory: "سوابق کاری", artHistory: "سوابق هنری", receiptUrl: "رسید پرداخت" };

function flatten(value: unknown, prefix = "", result: Record<string, string | number | boolean> = {}) {
  if (value === null || value === undefined) { result[prefix] = ""; return result; }
  if (typeof value !== "object") { result[prefix] = typeof value === "string" && /At$/.test(prefix) ? new Date(value).toLocaleString("fa-IR") : value as string | number | boolean; return result; }
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key, result));
  return result;
}

function header(key: string) { return key.split(".").map((part) => labels[part] || part).join(" - "); }
function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char); }

export default function ExportActions({ endpoint, title, fileName }: { endpoint: string; title: string; fileName: string }) {
  const [exportingPdf, setExportingPdf] = useState(false);
  async function records() {
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${getCookie("token") || ""}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "دریافت اطلاعات ناموفق بود");
    return data.records || [];
  }
  async function excel() {
    try {
      const rows = (await records()).map((item: unknown) => flatten(item));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const keys = Object.keys(rows[0] || {});
      XLSX.utils.sheet_add_aoa(worksheet, [keys.map(header)], { origin: "A1" });
      worksheet["!cols"] = keys.map(() => ({ wch: 24 }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, title);
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "ساخت فایل اکسل ناموفق بود"); }
  }
  async function pdf() {
    setExportingPdf(true);
    let report: HTMLDivElement | null = null;
    try {
      const rows = (await records()).map((item: unknown) => flatten(item));
      const keys = Object.keys(rows[0] || {});
      if (!keys.length) throw new Error("داده‌ای برای خروجی وجود ندارد");
      report = document.createElement("div");
      report.dir = "rtl";
      report.style.cssText = "position:fixed;left:-20000px;top:0;width:1120px;background:#fff;color:#17172a;padding:44px;box-sizing:border-box;font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right";
      report.innerHTML = `<section style="border-bottom:4px solid #03004b;padding-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px"><div><p style="margin:0;color:#7b5814;font-size:13px;font-weight:bold">آکادمی هنر و رسانه امام روح‌الله</p><h1 style="margin:10px 0 0;font-size:27px;color:#03004b">${escapeHtml(title)}</h1></div><div style="text-align:left;font-size:13px;color:#555;line-height:2">تاریخ گزارش<br><b>${new Date().toLocaleString("fa-IR")}</b></div></section><p style="font-size:13px;color:#555;line-height:2;margin:20px 0">گزارش رسمی سامانه آکادمی هنر و رسانه امام روح‌الله</p><table style="border-collapse:collapse;width:100%;font-size:12px;table-layout:fixed"><thead><tr>${keys.map((key) => `<th style="background:#03004b;color:#fff;border:1px solid #c9c9dc;padding:9px 7px;text-align:right;word-break:break-word">${escapeHtml(header(key))}</th>`).join("")}</tr></thead><tbody>${rows.map((row: Record<string, unknown>) => `<tr>${keys.map((key) => `<td style="border:1px solid #d8d8e5;padding:8px 7px;vertical-align:top;word-break:break-word;line-height:1.7">${escapeHtml(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      document.body.appendChild(report);
      await document.fonts?.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(report, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
      const margin = 10;
      const pageWidth = 210 - margin * 2;
      const pageHeight = 297 - margin * 2;
      const sourcePageHeight = Math.floor((pageHeight * canvas.width) / pageWidth);
      for (let offset = 0, page = 0; offset < canvas.height; offset += sourcePageHeight, page += 1) {
        const height = Math.min(sourcePageHeight, canvas.height - offset);
        const slice = document.createElement("canvas");
        slice.width = canvas.width; slice.height = height;
        slice.getContext("2d")?.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height);
        if (page) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/jpeg", 0.94), "JPEG", margin, margin, pageWidth, (height * pageWidth) / canvas.width, undefined, "FAST");
      }
      pdf.save(`${fileName}.pdf`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "ساخت فایل PDF ناموفق بود"); }
    finally { report?.remove(); setExportingPdf(false); }
  }
  return <div className="flex flex-wrap gap-2"><button onClick={excel} className="inline-flex items-center gap-2 rounded-xl border border-secondary bg-white px-3 py-2 text-xs font-bold text-secondary"><Download size={16} />خروجی اکسل</button><button onClick={pdf} disabled={exportingPdf} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{exportingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}دانلود PDF</button></div>;
}
