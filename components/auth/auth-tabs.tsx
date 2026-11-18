"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";

export function AuthTabs() {
  const [tab, setTab] = useState<string>("login");
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-5">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Sign in</TabsTrigger>
        <TabsTrigger value="register">Create account</TabsTrigger>
      </TabsList>
      <TabsContent value="login"><LoginForm /></TabsContent>
      <TabsContent value="register"><RegisterForm onDone={() => setTab("login")} /></TabsContent>
    </Tabs>
  );
}
