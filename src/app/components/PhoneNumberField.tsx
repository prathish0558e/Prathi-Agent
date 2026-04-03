import { countryCodeOptions } from '../data/countryCodes';

interface PhoneNumberFieldProps {
  countryCode: string;
  phoneNumber: string;
  onCountryCodeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
}

export function PhoneNumberField({
  countryCode,
  phoneNumber,
  onCountryCodeChange,
  onPhoneNumberChange,
}: PhoneNumberFieldProps) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <select
        value={countryCode}
        onChange={(event) => onCountryCodeChange(event.target.value)}
        className="bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2.5 outline-none focus:border-[#00D1FF]/60"
      >
        {countryCodeOptions.map((option) => (
          <option key={`${option.code}-${option.dialCode}`} value={option.dialCode}>
            {option.name} {option.dialCode}
          </option>
        ))}
      </select>
      <input
        value={phoneNumber}
        onChange={(event) => onPhoneNumberChange(event.target.value.replace(/[^0-9]/g, ''))}
        className="w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2.5 outline-none focus:border-[#00D1FF]/60"
        placeholder="Phone number"
        inputMode="numeric"
      />
    </div>
  );
}
