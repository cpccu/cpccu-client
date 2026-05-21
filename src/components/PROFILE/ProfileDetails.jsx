export default function ProfileDetails({ user }) {
  const details = [
    { title: "Email", value: user?.email },
    { title: "Phone", value: user?.phone },
    { title: "University ID", value: user?.uniID },
    { title: "Batch", value: user?.batch },
    { title: "Section", value: user?.section },
  ];

  return (
    <main className="bg-white p-8 lg:sticky lg:top-28 rounded-3xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-black text-gray-900 mb-6 border-b border-gray-50 pb-4">Details</h2>
      <section className="flex flex-col gap-6">
        {details.map((item, index) => (
          <DetailItem key={index} title={item.title} value={item.value} />
        ))}
      </section>
    </main>
  );
}

function DetailItem({ title, value }) {
  return (
    <main className="flex flex-col gap-1">
      <div className="text-xs font-black uppercase text-gray-400 tracking-widest">{title}</div>
      <div className="font-bold text-gray-800 text-lg truncate">{value || "Not provided"}</div>
    </main>
  );
}
