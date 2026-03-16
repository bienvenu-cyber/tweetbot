import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MessageSquare, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { usePostComment } from "@/hooks/use-posts";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const commentSchema = z.object({
  post_url: z.string().url("Please enter a valid Instagram post URL"),
  comment: z.string().min(1, "Comment text is required").max(300, "Comment is too long"),
});

export default function Comments() {
  const { toast } = useToast();
  const postComment = usePostComment();
  
  const form = useForm<z.infer<typeof commentSchema>>({
    resolver: zodResolver(commentSchema),
    defaultValues: { post_url: "", comment: "" }
  });

  const onSubmit = (data: z.infer<typeof commentSchema>) => {
    postComment.mutate(data, {
      onSuccess: () => {
        toast({ title: "Success", description: "Comment posted successfully." });
        form.reset();
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Post Comment</h1>
        <p className="text-muted-foreground mt-1">Leave a comment on a specific Instagram post.</p>
      </div>

      <Card className="border-border shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            New Comment
          </CardTitle>
          <CardDescription>Enter the target post URL and your message.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label>Instagram Post URL</Label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="https://www.instagram.com/p/..." 
                  className="pl-9 bg-background/50 h-11" 
                  {...form.register("post_url")} 
                />
              </div>
              {form.formState.errors.post_url && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.post_url.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Comment Text</Label>
                <span className="text-xs text-muted-foreground">{form.watch("comment").length}/300</span>
              </div>
              <Textarea 
                placeholder="Write your comment here..." 
                className="min-h-[150px] bg-background/50 resize-none" 
                {...form.register("comment")} 
              />
              {form.formState.errors.comment && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.comment.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={postComment.isPending} 
              className="w-full h-12 text-base font-medium shadow-lg shadow-primary/25"
            >
              {postComment.isPending ? "Posting..." : <><CheckCircle2 className="w-5 h-5 mr-2" /> Post Comment</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
