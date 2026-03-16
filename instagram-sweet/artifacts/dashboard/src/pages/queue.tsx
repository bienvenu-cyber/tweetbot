import { motion } from "framer-motion";
import { format } from "date-fns";
import { ListOrdered, Trash2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useQueue, useDeleteQueueItem } from "@/hooks/use-queue";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Queue() {
  const { data, isLoading } = useQueue();
  const deleteItem = useDeleteQueueItem();
  const { toast } = useToast();

  const handleDelete = (id: number) => {
    deleteItem.mutate(id, {
      onSuccess: () => toast({ title: "Deleted", description: "Item removed from queue." }),
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Action Queue</h1>
        <p className="text-muted-foreground mt-1">Manage scheduled and pending automation tasks.</p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-primary" />
            Pending Actions ({data?.total || 0})
          </CardTitle>
          <CardDescription>Items are executed sequentially according to your configured delays.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50">
            <Table>
              <TableHeader className="bg-secondary/50">
                <TableRow className="border-border/50">
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Loading queue...</TableCell>
                  </TableRow>
                ) : data?.items && data.items.length > 0 ? (
                  data.items.map((item) => (
                    <TableRow key={item.id} className="border-border/50 hover:bg-secondary/30 transition-colors">
                      <TableCell className="font-mono text-xs text-muted-foreground">#{item.id}</TableCell>
                      <TableCell className="font-medium capitalize">{item.action_type.replace('_', ' ')}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={item.target}>{item.target}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`
                          ${item.status === 'pending' ? 'border-yellow-500/50 text-yellow-500 bg-yellow-500/10' : ''}
                          ${item.status === 'processing' ? 'border-blue-500/50 text-blue-500 bg-blue-500/10 animate-pulse' : ''}
                        `}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.scheduled_at ? format(new Date(item.scheduled_at), "PP p") : "Immediate"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(item.id)}
                          disabled={deleteItem.isPending && deleteItem.variables === item.id}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center opacity-50">
                        <CheckCircle2 className="w-8 h-8 mb-2" />
                        <p>Queue is empty</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
