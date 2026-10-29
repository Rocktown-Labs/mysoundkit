import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordField({
  autoComplete,
  id,
  label = "Password",
  minLength,
  onChange,
  placeholder,
  value,
}: {
  autoComplete: "current-password" | "new-password";
  id: string;
  label?: string;
  minLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-semibold" htmlFor={id}>
        {label}
      </Label>
      <div className="relative">
        <Input
          autoComplete={autoComplete}
          className="h-[46px] rounded-[10px] border-[#27272A] bg-[#050507] dark:bg-[#050507] pr-12 text-base md:text-[15px] text-[#FAFAFA] placeholder:text-[#71717A] focus-visible:border-[#B8A3FF] focus-visible:ring-[#B8A3FF]/30"
          id={id}
          minLength={minLength}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
          type={visible ? "text" : "password"}
          value={value}
        />
        <Button
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-muted-foreground hover:bg-[#18181B] hover:text-[#FAFAFA] dark:hover:text-[#FAFAFA] dark:hover:bg-[#18181B]"
          onClick={() => setVisible((current) => !current)}
          type="button"
          variant="ghost"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
