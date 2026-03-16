import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Activity, Filter, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useLogs } from "@/hooks/use-logs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Logs() {
  const [actionType, setActionType] = useState<string>("all");
  const { data, isLoading } = useLogs({ 
    limit: 50, 
    action_type: actionType === "all" ? undefined : actionType 
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Activity Logs</h1>
          <p className="text-muted-foreground mt-1">Complete history of bot operations and results.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card p-2 rounded-lg border border-border shadow-sm">
          <Filter className="w-4 h-4 text-muted-foreground ml-2" />
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger className="w-[180px] bg-transparent border-0 focus:ring-0 shadow-none h-8">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="send_dm">Direct Messages</SelectItem>
              <SelectItem value="post_comment">Comments</SelectItem>
              <SelectItem value="create_post">Posts</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow className="border-border/50">
                  <TableHead className="w-[180px] pl-6 py-4">Timestamp</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="w-1/2 pr-6">Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Loading logs...</TableCell>
                  </TableRow>
                ) : data?.logs && data.logs.length > 0 ? (
                  data.logs.map((log) => (
                    <TableRow key={log.id} className="border-border/50 hover:bg-secondary/20 transition-colors">
                      <TableCell className="text-sm text-muted-foreground pl-6 whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-background capitalize">
                          {log.action_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {log.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {log.status === "failed" && <AlertCircle className="w-4 h-4 text-destructive" />}
                          {log.status === "info" && <Info className="w-4 h-4 text-blue-500" />}
                          <span className={`text-sm capitalize
                            ${log.status === 'success' ? 'text-emerald-500' : ''}
                            ${log.status === 'failed' ? 'text-destructive' : ''}
                            ${log.status === 'info' ? 'text-blue-500' : ''}
                          `}>
                            {log.status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium truncate max-w-[150px]">{log.target}</TableCell>
                      <TableCell className="text-sm text-muted-foreground pr-6 truncate max-w-[300px]" title={log.message}>
                        {log.message}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No logs found for the selected criteria.
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
