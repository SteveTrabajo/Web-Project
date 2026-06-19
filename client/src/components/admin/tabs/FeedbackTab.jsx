import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "../utils/adminApi";

const REASON_LABELS = {
  insufficient:  "מידע לא מספיק",
  unclear:       "מידע לא ברור",
  irrelevant:    "תשובה לא רלוונטית",
  outdated:      "מידע לא עדכני",
  missing_topic: "נושא לא מכוסה",
  other:         "אחר",
};

function FeedbackCard({ item }) {
  const isPositive = item.rating === "positive";
  const relativeTime = (() => {
    if (!item.createdAt) return "";
    const diff = Date.now() - new Date(item.createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "הרגע";
    if (minutes < 60) return `לפני ${minutes} דקות`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `לפני ${hours} שעות`;
    return `לפני ${Math.floor(hours / 24)} ימים`;
  })();

  return (
    <div className="flex gap-3 p-3 rounded-xl border border-border bg-muted/30">
      <div className="text-2xl shrink-0">{isPositive ? "👍" : "👎"}</div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {item.reasons?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.reasons.map((r) => (
              <Badge key={r} variant="secondary" className="text-caption">
                {REASON_LABELS[r] ?? r}
              </Badge>
            ))}
          </div>
        )}
        {item.comment && (
          <p className="text-caption text-foreground break-words">{item.comment}</p>
        )}
        <div className="text-caption text-muted-foreground">{relativeTime}</div>
      </div>
    </div>
  );
}

export default function FeedbackTab({ toast }) {
  const [feedback, setFeedback]               = useState([]);
  const [feedbackPage, setFeedbackPage]       = useState(1);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackHasMore, setFeedbackHasMore] = useState(true);
  const [exporting, setExporting]             = useState(false);
  const [emailing, setEmailing]               = useState(false);
  const [ratingFilter, setRatingFilter]       = useState("all");
  const [fromDate, setFromDate]               = useState("");
  const [toDate, setToDate]                   = useState("");

  const loadFeedback = async (page = 1) => {
    setFeedbackLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (ratingFilter !== "all") params.set("rating", ratingFilter);
      if (fromDate) params.set("from", `${fromDate}T00:00:00.000Z`);
      if (toDate)   params.set("to",   `${toDate}T23:59:59.999Z`);
      const data = await apiFetch(`/api/admin/feedback?${params}`);
      const items = data.feedback || [];
      setFeedback((prev) => (page === 1 ? items : [...prev, ...items]));
      setFeedbackPage(page);
      setFeedbackHasMore(data.hasMore ?? false);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Pulls every page so the export covers all feedback, not just the loaded ones.
  const fetchAllFeedback = async () => {
    const all = [];
    let page = 1;
    while (true) {
      const data = await apiFetch(`/api/admin/feedback?page=${page}&limit=100`);
      const items = data.feedback || [];
      all.push(...items);
      if (items.length < 100) break;
      page++;
    }
    return all;
  };

  // Filter values shared by the CSV download and the email export.
  const filterBounds = () => ({
    rating: ratingFilter === "all" ? undefined : ratingFilter,
    from: fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
    to: toDate ? `${toDate}T23:59:59.999Z` : undefined,
  });

  const applyFilters = (items) => {
    const { rating, from, to } = filterBounds();
    return items.filter((f) => {
      if (rating && f.rating !== rating) return false;
      if (from && (f.createdAt || "") < from) return false;
      if (to && (f.createdAt || "") > to) return false;
      return true;
    });
  };

  const toCsv = (rows) => {
    const header = ["דירוג", "סיבות", "הערה", "תאריך"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [header.map(esc).join(",")];
    for (const r of rows) {
      const rating = r.rating === "positive" ? "חיובי" : "שלילי";
      const reasons = (r.reasons || []).map((x) => REASON_LABELS[x] ?? x).join("; ");
      const date = r.createdAt ? new Date(r.createdAt).toLocaleString("he-IL") : "";
      lines.push([rating, reasons, r.comment, date].map(esc).join(","));
    }
    // BOM so Excel reads the Hebrew as UTF-8.
    return "﻿" + lines.join("\r\n");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = applyFilters(await fetchAllFeedback());
      if (rows.length === 0) {
        toast("error", "אין משובים לייצוא");
        return;
      }
      const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("ok", `יוצאו ${rows.length} משובים`);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleEmailExport = async () => {
    setEmailing(true);
    try {
      const data = await apiFetch("/api/admin/feedback/export-email", {
        method: "POST",
        body: filterBounds(),
      });
      toast("ok", `נשלחו ${data.count} משובים למייל`);
    } catch (e) {
      toast("error", e.message);
    } finally {
      setEmailing(false);
    }
  };

  // Reload from page 1 whenever a filter changes, and on initial mount.
  useEffect(() => { loadFeedback(1); }, [ratingFilter, fromDate, toDate]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-heading">משובים</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || feedbackLoading}>
              {exporting ? "מייצא..." : "ייצוא CSV"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleEmailExport} disabled={emailing || feedbackLoading}>
              {emailing ? "שולח..." : "שליחה למייל"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => loadFeedback(1)} disabled={feedbackLoading}>
              רענון
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="space-y-1">
            <label className="text-caption text-muted-foreground">דירוג</label>
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger dir="rtl" className="w-36">
                <span>{{ all: "הכל", positive: "חיובי", negative: "שלילי" }[ratingFilter]}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">הכל</SelectItem>
                <SelectItem value="positive">חיובי</SelectItem>
                <SelectItem value="negative">שלילי</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-caption text-muted-foreground">מתאריך</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-caption text-muted-foreground">עד תאריך</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
          </div>
        </div>

        {feedbackLoading && feedback.length === 0 ? (
          <div className="py-10 text-center text-body text-muted-foreground animate-pulse">טוען משובים...</div>
        ) : feedback.length === 0 ? (
          <div className="py-10 text-center text-body text-muted-foreground">אין משובים עדיין</div>
        ) : (
          <div className="space-y-3">
            {feedback.map((f) => <FeedbackCard key={f.id} item={f} />)}
            {feedbackHasMore && (
              <div className="pt-2 flex justify-center">
                <Button size="sm" variant="outline" onClick={() => loadFeedback(feedbackPage + 1)} disabled={feedbackLoading}>
                  {feedbackLoading ? "טוען..." : "טען עוד"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
