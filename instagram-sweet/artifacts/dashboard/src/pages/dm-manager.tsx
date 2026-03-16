import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Users, User, Clock, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSendDm, useBulkSendDm, useDmThreads } from "@/hooks/use-dm";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const singleDmSchema = z.object({
  username: z.string().min(1, "Username is required"),
  message: z.string().min(1, "Message is required"),
});

const bulkDmSchema = z.object({
  usernames: z.string().min(1, "At least one username is required"),
  message: z.string().min(1, "Message is required"),
  delay_min: z.coerce.number().min(5, "Min delay must be >= 5"),
  delay_max: z.coerce.number().min(10, "Max delay must be >= 10"),
});

export default function DmManager() {
  const { toast } = useToast();
  const sendDm = useSendDm();
  const bulkSendDm = useBulkSendDm();
  const { data: threadsData, isLoading: threadsLoading } = useDmThreads(20);

  const singleForm = useForm<z.infer<typeof singleDmSchema>>({
    resolver: zodResolver(singleDmSchema),
    defaultValues: { username: "", message: "" }
  });

  const bulkForm = useForm<z.infer<typeof bulkDmSchema>>({
    resolver: zodResolver(bulkDmSchema),
    defaultValues: { usernames: "", message: "", delay_min: 30, delay_max: 120 }
  });

  const onSingleSubmit = (data: z.infer<typeof singleDmSchema>) => {
    sendDm.mutate(data, {
      onSuccess: () => {
        toast({ title: "Message Sent", description: `Successfully sent to ${data.username}` });
        singleForm.reset();
      },
      onError: (err) => {
        toast({ title: "Failed to send", description: err.message, variant: "destructive" });
      }
    });
  };

  const onBulkSubmit = (data: z.infer<typeof bulkDmSchema>) => {
    const usernameArray = data.usernames.split("\n").map(u => u.trim().replace('@', '')).filter(Boolean);
    if (usernameArray.length === 0) {
      toast({ title: "Error", description: "Please enter valid usernames", variant: "destructive" });
      return;
    }

    bulkSendDm.mutate({
      usernames: usernameArray,
      message: data.message,
      delay_min: data.delay_min,
      delay_max: data.delay_max
    }, {
      onSuccess: (res) => {
        toast({ title: "Bulk Send Queued", description: `Queued ${res.queued} messages.` });
        bulkForm.reset();
      },
      onError: (err) => {
        toast({ title: "Failed to queue", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">DM Manager</h1>
        <p className="text-muted-foreground mt-1">Send individual messages or queue bulk campaigns.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="col-span-1 lg:col-span-2">
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-secondary/50">
              <TabsTrigger value="single" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <User className="w-4 h-4 mr-2" /> Single Message
              </TabsTrigger>
              <TabsTrigger value="bulk" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="w-4 h-4 mr-2" /> Bulk Campaign
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="m-0">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Send Direct Message</CardTitle>
                  <CardDescription>Send a single message instantly.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={singleForm.handleSubmit(onSingleSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Target Username</Label>
                      <Input placeholder="@username" {...singleForm.register("username")} className="bg-background/50" />
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Textarea placeholder="Type your message here..." className="min-h-[120px] bg-background/50" {...singleForm.register("message")} />
                    </div>
                    <Button type="submit" disabled={sendDm.isPending} className="w-full bg-primary hover:bg-primary/90 text-white">
                      {sendDm.isPending ? "Sending..." : <><Send className="w-4 h-4 mr-2" /> Send Message</>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bulk" className="m-0">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Bulk Message Campaign</CardTitle>
                  <CardDescription>Queue messages to multiple users with safe delays.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Usernames (One per line)</Label>
                      <Textarea 
                        placeholder="@user1&#10;@user2&#10;@user3" 
                        className="min-h-[120px] font-mono text-sm bg-background/50" 
                        {...bulkForm.register("usernames")} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Message Template</Label>
                      <Textarea 
                        placeholder="Hello! Thanks for..." 
                        className="min-h-[120px] bg-background/50" 
                        {...bulkForm.register("message")} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Min Delay (seconds)</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input type="number" className="pl-9 bg-background/50" {...bulkForm.register("delay_min")} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Max Delay (seconds)</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input type="number" className="pl-9 bg-background/50" {...bulkForm.register("delay_max")} />
                        </div>
                      </div>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex items-start gap-2 mt-4 text-yellow-200">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-xs">Messages will be added to the queue and sent sequentially adhering to the randomized delays to avoid rate limits.</p>
                    </div>
                    <Button type="submit" disabled={bulkSendDm.isPending} className="w-full bg-primary hover:bg-primary/90 text-white mt-4">
                      {bulkSendDm.isPending ? "Queueing..." : <><Users className="w-4 h-4 mr-2" /> Queue Campaign</>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Threads Sidebar */}
        <div className="col-span-1">
          <Card className="border-border h-full flex flex-col max-h-[800px]">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle>Recent Inbox</CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
              {threadsLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-secondary"></div>
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-4 bg-secondary rounded w-1/3"></div>
                        <div className="h-3 bg-secondary rounded w-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : threadsData?.threads && threadsData.threads.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {threadsData.threads.map((thread) => (
                    <div key={thread.id} className="p-4 hover:bg-secondary/30 transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm truncate pr-2 group-hover:text-primary transition-colors">
                          {thread.users.join(", ")}
                        </p>
                        {thread.unread && <Badge variant="default" className="bg-primary hover:bg-primary shrink-0">New</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{thread.last_message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No recent threads found.</p>
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
