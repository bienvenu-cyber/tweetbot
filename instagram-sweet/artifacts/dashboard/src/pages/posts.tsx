import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarPlus, Image as ImageIcon, Send } from "lucide-react";
import { useCreatePost } from "@/hooks/use-posts";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const postSchema = z.object({
  image_url: z.string().url("Valid image URL required"),
  caption: z.string().min(1, "Caption is required"),
  schedule_at: z.string().optional(),
});

export default function Posts() {
  const { toast } = useToast();
  const createPost = useCreatePost();
  
  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: { image_url: "", caption: "", schedule_at: "" }
  });

  const imagePreview = form.watch("image_url");

  const onSubmit = (data: z.infer<typeof postSchema>) => {
    // Clean up empty schedule_at
    const payload = {
      ...data,
      schedule_at: data.schedule_at ? new Date(data.schedule_at).toISOString() : undefined
    };
    
    createPost.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Success", description: data.schedule_at ? "Post scheduled." : "Post published." });
        form.reset();
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Create Post</h1>
        <p className="text-muted-foreground mt-1">Publish or schedule a new photo to your timeline.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-primary" />
              Post Details
            </CardTitle>
            <CardDescription>Fill out the content for your new Instagram post.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label>Image URL (Must be direct image link, e.g. .jpg/.png)</Label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="https://example.com/image.jpg" 
                    className="pl-9 bg-background/50 h-11" 
                    {...form.register("image_url")} 
                  />
                </div>
                {form.formState.errors.image_url && <p className="text-xs text-destructive mt-1">{form.formState.errors.image_url.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Caption</Label>
                <Textarea 
                  placeholder="Write your caption here... #hashtags" 
                  className="min-h-[180px] bg-background/50 resize-y" 
                  {...form.register("caption")} 
                />
                {form.formState.errors.caption && <p className="text-xs text-destructive mt-1">{form.formState.errors.caption.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Schedule (Optional)</Label>
                <Input 
                  type="datetime-local" 
                  className="bg-background/50 h-11 block w-full text-foreground color-scheme-dark"
                  {...form.register("schedule_at")}
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank to post immediately.</p>
              </div>

              <Button 
                type="submit" 
                disabled={createPost.isPending} 
                className="w-full h-12 text-base font-medium shadow-lg shadow-primary/25 mt-4"
              >
                {createPost.isPending ? "Processing..." : <><Send className="w-5 h-5 mr-2" /> Publish Post</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Preview Pane */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-2">Live Preview</h3>
          <div className="max-w-[360px] mx-auto bg-black rounded-3xl border border-border shadow-2xl overflow-hidden text-white pb-6 relative">
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20"></div>
                <div className="text-sm font-semibold">your_account</div>
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
                <span className="font-semibold text-sm mr-2">your_account</span>
                <span className="text-sm whitespace-pre-wrap">{form.watch("caption") || "Your caption will appear here..."}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
