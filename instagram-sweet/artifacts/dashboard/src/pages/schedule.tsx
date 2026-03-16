import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, isSameDay, parseISO } from "date-fns";
import { CalendarPlus, Image as ImageIcon, Send, Trash2, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useScheduledPosts, useDeleteScheduledPost, type ScheduledPost } from "@/hooks/use-scheduled-posts";
import { useCreatePost } from "@/hooks/use-posts";
import { useAccounts } from "@/hooks/use-accounts";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const scheduleSchema = z.object({
  image_url: z.string().url("Valid image URL required"),
  caption: z.string().min(1, "Caption is required"),
  schedule_at: z.string().min(1, "Schedule date/time is required"),
  account_username: z.string().optional(),
});

export default function Schedule() {
  const { toast } = useToast();
  const { data: posts = [], isLoading } = useScheduledPosts();
  const { data: accounts = [] } = useAccounts();
  const createPost = useCreatePost();
  const deletePost = useDeleteScheduledPost();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const form = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { image_url: "", caption: "", schedule_at: "", account_username: "" },
  });

  const imagePreview = form.watch("image_url");

  const onSubmit = (data: z.infer<typeof scheduleSchema>) => {
    const payload = {
      image_url: data.image_url,
      caption: data.caption,
      schedule_at: new Date(data.schedule_at).toISOString(),
      account_username: data.account_username || undefined,
    };
    createPost.mutate(payload as any, {
      onSuccess: () => {
        toast({ title: "Scheduled!", description: `Post scheduled for ${format(new Date(data.schedule_at), "PPP p")}` });
        form.reset();
      },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  // Days that have scheduled posts
  const scheduledDays = posts
    .filter(p => p.status === "pending")
    .map(p => parseISO(p.scheduled_at));

  // Posts for selected date
  const dayPosts = selectedDate
    ? posts.filter(p => isSameDay(parseISO(p.scheduled_at), selectedDate))
    : [];

  const statusIcon = (status: string) => {
    switch (status) {
      case "published": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "failed": return <AlertCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Post Scheduler</h1>
        <p className="text-muted-foreground mt-1">Plan and schedule your Instagram posts with a visual calendar.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar */}
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-primary" /> Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="pointer-events-auto"
              modifiers={{ scheduled: scheduledDays }}
              modifiersClassNames={{ scheduled: "bg-primary/20 text-primary font-bold" }}
            />
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded bg-primary/20"></span> Has scheduled posts
            </div>

            {/* Posts for selected day */}
            {selectedDate && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  {format(selectedDate, "MMMM d, yyyy")}
                </h4>
                {dayPosts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No posts scheduled for this day.</p>
                ) : (
                  dayPosts.map(post => (
                    <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-secondary shrink-0">
                        <img src={post.image_url} alt="" className="w-full h-full object-cover" onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {statusIcon(post.status)}
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(post.scheduled_at), "HH:mm")}
                          </span>
                          <Badge variant="outline" className="text-xs">@{post.account_username}</Badge>
                        </div>
                        <p className="text-sm text-foreground mt-1 truncate">{post.caption}</p>
                      </div>
                      {post.status === "pending" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => deletePost.mutate(post.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule Form */}
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>Schedule New Post</CardTitle>
            <CardDescription>Fill out the details and pick a date/time.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {accounts.length > 1 && (
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select onValueChange={(v) => form.setValue("account_username", v)}>
                    <SelectTrigger><SelectValue placeholder="Auto (round-robin)" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.is_active).map(a => (
                        <SelectItem key={a.username} value={a.username}>@{a.username}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Image URL</Label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="https://example.com/image.jpg" className="pl-9 h-11" {...form.register("image_url")} />
                </div>
                {form.formState.errors.image_url && <p className="text-xs text-destructive">{form.formState.errors.image_url.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Caption</Label>
                <Textarea placeholder="Write your caption... #hashtags" className="min-h-[120px] resize-y" {...form.register("caption")} />
                {form.formState.errors.caption && <p className="text-xs text-destructive">{form.formState.errors.caption.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Schedule Date & Time</Label>
                <Input type="datetime-local" className="h-11" {...form.register("schedule_at")} />
                {form.formState.errors.schedule_at && <p className="text-xs text-destructive">{form.formState.errors.schedule_at.message}</p>}
              </div>

              <Button type="submit" disabled={createPost.isPending} className="w-full h-12 text-base font-medium shadow-lg shadow-primary/25">
                {createPost.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                Schedule Post
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Live Preview</h3>
          <div className="max-w-[360px] mx-auto bg-black rounded-3xl border border-border shadow-2xl overflow-hidden text-white pb-6">
            <div className="h-14 flex items-center px-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20"></div>
                <div className="text-sm font-semibold">
                  {form.watch("account_username") || "your_account"}
                </div>
              </div>
            </div>

            <div className="w-full aspect-square bg-secondary flex items-center justify-center overflow-hidden">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNTU1IiBzdHJva2Utd2lkdGg9IjIiPjxyZWN0IHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgeD0iMyIgeT0iMyIgcng9IjIiIHJ5PSIyIi8+PGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz48cGF0aCBkPSJNMjEgMTVMMTYgMTBMNSAyMSIvPjwvc3ZnPg==';
                }} />
              ) : (
                <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
              )}
            </div>

            <div className="px-4 pt-3 space-y-2">
              <div className="flex gap-4">
                <div className="w-6 h-6 rounded-full border-2 border-white/40"></div>
                <div className="w-6 h-6 rounded-full border-2 border-white/40"></div>
                <div className="w-6 h-6 rounded-full border-2 border-white/40"></div>
              </div>
              <div>
                <span className="font-semibold text-sm mr-2">{form.watch("account_username") || "your_account"}</span>
                <span className="text-sm whitespace-pre-wrap">{form.watch("caption") || "Your caption will appear here..."}</span>
              </div>
              {form.watch("schedule_at") && (
                <div className="flex items-center gap-1.5 text-xs text-blue-400 mt-2">
                  <Clock className="w-3 h-3" />
                  Scheduled for {format(new Date(form.watch("schedule_at")), "PPP 'at' p")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Posts Table */}
      <Card className="border-border shadow-lg">
        <CardHeader>
          <CardTitle>All Scheduled Posts</CardTitle>
          <CardDescription>{posts.filter(p => p.status === "pending").length} pending · {posts.filter(p => p.status === "published").length} published</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : posts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">No scheduled posts yet.</p>
          ) : (
            <div className="space-y-2">
              {posts.map(post => (
                <div key={post.id} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-secondary shrink-0">
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{post.caption}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>@{post.account_username}</span>
                      <span>{format(parseISO(post.scheduled_at), "MMM d, HH:mm")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusIcon(post.status)}
                    <Badge variant={
                      post.status === "published" ? "default" :
                      post.status === "failed" ? "destructive" : "secondary"
                    } className="capitalize text-xs">
                      {post.status}
                    </Badge>
                    {post.status === "pending" && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-destructive" onClick={() => deletePost.mutate(post.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
