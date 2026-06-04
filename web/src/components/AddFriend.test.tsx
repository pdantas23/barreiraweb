import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddFriend } from "./AddFriend";

describe("AddFriend", () => {
  it("digita username e envia: chama onAdd e mostra feedback de sucesso", async () => {
    const onAdd = vi.fn().mockResolvedValue({ ok: true });
    render(<AddFriend onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText("Username do amigo"), { target: { value: "bob" } });
    fireEvent.click(screen.getByText("Adicionar"));

    await waitFor(() => expect(onAdd).toHaveBeenCalledWith("bob"));
    expect(await screen.findByText("Pedido enviado!")).toBeInTheDocument();
  });

  it("erro do onAdd vira feedback de erro", async () => {
    const onAdd = vi.fn().mockResolvedValue({ ok: false, error: "Usuário não encontrado." });
    render(<AddFriend onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText("Username do amigo"), { target: { value: "ghost" } });
    fireEvent.click(screen.getByText("Adicionar"));
    expect(await screen.findByText("Usuário não encontrado.")).toBeInTheDocument();
  });
});
