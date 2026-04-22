import { createFileRoute } from "@tanstack/react-router";
import { 
  UserPlus, 
  Mail, 
  MoreVertical, 
  ShieldCheck, 
  Users, 
  UserCheck, 
  Clock, 
  ArrowUpDown,
  Search,
  Settings2,
  Trash2,
  ExternalLink
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { InviteMemberDialog } from "@/components/dashboard/team/invite-member-dialog";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "pending" | "inactive";
  avatar?: string;
  joinedAt: string;
  lastActive: string;
}

const teamData: TeamMember[] = [
  {
    id: "1",
    name: "Jessica Martinez",
    email: "jessica@soundkit.app",
    role: "Admin",
    status: "active",
    avatar: "/diverse-user-avatars.png",
    joinedAt: "2023-10-12",
    lastActive: "2 minutes ago",
  },
  {
    id: "2",
    name: "David Kim",
    email: "david@soundkit.app",
    role: "Manager",
    status: "active",
    avatar: "/diverse-user-avatars.png",
    joinedAt: "2023-11-05",
    lastActive: "1 hour ago",
  },
  {
    id: "3",
    name: "Emma Wilson",
    email: "emma@soundkit.app",
    role: "Editor",
    status: "pending",
    avatar: "/diverse-user-avatars.png",
    joinedAt: "2024-04-18",
    lastActive: "Never",
  },
  {
    id: "4",
    name: "Marcus Thorne",
    email: "marcus@soundkit.app",
    role: "Viewer",
    status: "inactive",
    avatar: "/diverse-user-avatars.png",
    joinedAt: "2024-01-20",
    lastActive: "2 weeks ago",
  },
];

export const Route = createFileRoute("/dashboard/team")({
  component: TeamPage,
});

function TeamPage() {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const teamStats = [
    {
      title: "Team Seats",
      value: "4 / 10",
      description: "6 seats available on Pro+ plan",
      icon: Users,
    },
    {
      title: "Active Members",
      value: "2",
      description: "Currently online or active",
      icon: UserCheck,
    },
    {
      title: "Pending Invites",
      value: "1",
      description: "Awaiting confirmation",
      icon: Clock,
    },
    {
      title: "Admin Roles",
      value: "1",
      description: "Full management access",
      icon: ShieldCheck,
    },
  ];

  const columns = useMemo<ColumnDef<TeamMember>[]>(() => [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="p-0 hover:bg-transparent font-semibold uppercase text-[10px] tracking-widest text-muted-foreground"
        >
          Member
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const member = row.original;
        return (
          <div className="flex items-center gap-3 py-1">
            <Avatar className="size-9 border border-border/40">
              <AvatarImage src={member.avatar} />
              <AvatarFallback>{member.name[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm truncate">{member.name}</span>
              <span className="text-[11px] text-muted-foreground truncate">{member.email}</span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: () => <span className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground">Role</span>,
      cell: ({ row }) => (
        <Badge variant="secondary" className="bg-muted/50 text-[10px] uppercase tracking-wider h-5 font-bold">
          {row.getValue("role")}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: () => <span className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground">Status</span>,
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] uppercase tracking-wider h-5",
              status === "active" ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" :
              status === "pending" ? "text-amber-500 border-amber-500/20 bg-amber-500/5" :
              "text-muted-foreground border-border/40"
            )}
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "lastActive",
      header: () => <span className="font-semibold uppercase text-[10px] tracking-widest text-muted-foreground">Last Active</span>,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.getValue("lastActive")}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings2 className="mr-2 size-4" />
                Edit Role
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink className="mr-2 size-4" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 size-4" />
                Remove Member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], []);

  const table = useReactTable({
    data: teamData,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-playfair)] tracking-tight">
            Team
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your professional circle and account seats.
          </p>
        </div>
        <Button 
          onClick={() => setIsInviteOpen(true)}
          className="shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
        >
          <UserPlus className="mr-2 size-4" />
          Invite Team Member
        </Button>
      </div>

      {/* Stats Grid */}
      <StatsGrid stats={teamStats} />

      {/* Team Table Card */}
      <Card className="bg-card/40 backdrop-blur-sm border-border/40 overflow-hidden">
        <CardHeader className="border-b border-border/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Team Members</CardTitle>
              <CardDescription className="text-xs mt-1">
                Collaborators with management access to your SoundKit account.
              </CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder="Filter members..." 
                className="pl-9 bg-muted/30 border-none"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border/10 bg-muted/20">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th 
                        key={header.id} 
                        className="px-6 py-4 text-left font-medium"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-border/10">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {teamData.length === 0 && (
            <div className="py-20 text-center">
              <Users className="size-12 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="text-lg font-medium">No team members yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Start building your professional team by inviting your first collaborator.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-card/40 border-border/40 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Team Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Team members help manage your music career. They have broader
              access to your account and can help with management, marketing,
              social media, and other business aspects. They occupy a "seat" on your plan.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/40 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/40" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-blue-500" />
              Collaborators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Collaborators are artists you work with on specific tracks or
              projects. They only have access to what they're invited to, with 
              limited permissions. They do not occupy team seats.
            </p>
          </CardContent>
        </Card>
      </div>

      <InviteMemberDialog 
        isOpen={isInviteOpen} 
        onOpenChange={setIsInviteOpen}
        seatsUsed={4}
        totalSeats={10}
      />
    </div>
  );
}
