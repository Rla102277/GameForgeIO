import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, Users, Loader2, Crown, User } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${window.location.origin}${BASE}/api`;

interface AppUser {
  id: number;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
}

export default function AdminPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  async function authFetch(url: string, options: RequestInit = {}) {
    const token = await getToken();
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  useEffect(() => {
    authFetch(`${API}/admin/users`)
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 403 ? "You don't have admin access." : "Failed to load users");
        return r.json();
      })
      .then((data: AppUser[]) => setUsers(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleRole(clerkId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    setUpdating(clerkId);
    try {
      const res = await authFetch(`${API}/admin/users/${clerkId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      const updated: AppUser = await res.json();
      setUsers(prev => prev.map(u => u.clerkId === clerkId ? updated : u));
      toast({ title: "Role updated", description: `${updated.email} is now ${newRole}.` });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  }

  async function removeUser(clerkId: string, email: string) {
    if (!confirm(`Remove ${email} from the system?`)) return;
    setUpdating(clerkId);
    try {
      await authFetch(`${API}/admin/users/${clerkId}`, { method: "DELETE" });
      setUsers(prev => prev.filter(u => u.clerkId !== clerkId));
      toast({ title: "User removed" });
    } catch {
      toast({ title: "Remove failed", variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  }

  const displayName = (u: AppUser) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/80 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <Shield className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium">Admin Panel</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage user roles and access</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{users.length} registered</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading users…</span>
          </div>
        ) : error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">{error}</p>
              <p className="text-muted-foreground text-xs mt-1">
                Make sure your account has admin privileges. Contact another admin to grant access.
              </p>
            </CardContent>
          </Card>
        ) : users.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No users registered yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Users</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {users.map(u => {
                  const isMe = u.clerkId === user?.id;
                  return (
                    <div key={u.clerkId} className="flex items-center gap-4 px-6 py-4">
                      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-border flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground">
                        {displayName(u).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{displayName(u)}</p>
                          {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge
                          variant="outline"
                          className={u.role === "admin"
                            ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                            : "border-border text-muted-foreground"
                          }
                        >
                          {u.role === "admin"
                            ? <><Crown className="h-2.5 w-2.5 mr-1" />Admin</>
                            : <><User className="h-2.5 w-2.5 mr-1" />User</>
                          }
                        </Badge>
                        {!isMe && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              disabled={updating === u.clerkId}
                              onClick={() => toggleRole(u.clerkId, u.role)}
                            >
                              {updating === u.clerkId
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : u.role === "admin" ? "Revoke admin" : "Make admin"
                              }
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={updating === u.clerkId}
                              onClick={() => removeUser(u.clerkId, u.email)}
                            >
                              Remove
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
