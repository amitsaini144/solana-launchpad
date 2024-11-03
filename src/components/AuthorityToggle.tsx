import { Controller, Control } from "react-hook-form";
import { TokenFormData } from "./TokenForm";
import { Switch } from "@/components/ui/switch"

export default function AuthorityToggle({ label, description, name, control }: {
    label: string;
    description: string;
    name: keyof TokenFormData;
    control: Control<TokenFormData>;
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-white">{label}</label>
            <p className="text-xs text-gray-400">{description}</p>
            <Controller
                name={name}
                control={control}
                render={({ field: { onChange, value } }) => (
                    <Switch
                        checked={value as boolean}
                        onCheckedChange={onChange}
                    />
                )}
            />
        </div>
    );
}