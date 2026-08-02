/** Mock critique texts for library-item audit modal (legacy demo path). */

export const MOCK_AUDIT_CRITIQUES = {
  devil:
    'I reviewed the draft and have to say: **This is not persuasive.**\n\n**Critical weaknesses:**\n\n1. **Missing legal basis:** The argument relies on vague hints instead of concrete statutes.\n\n2. **Logical jump:** The link between premise A and conclusion B is missing.\n\n3. **Opening for the other side:** Paragraph X can easily be turned against you.\n\nMy recommendation: **Back to the drawing board.** This draft would not hold up for five minutes in court.',
  judge:
    'I reviewed the draft objectively. Here is my assessment:\n\n**Formal structure:** ✓ Mostly correct\n\n**Substance:**\n- Legal basis: Partially incomplete (statutes missing)\n- Logical rigor: Understandable, but thin in 2 places\n- Facts: Not all claims are supported\n\n**Verdict:** The draft has potential but needs stronger legal grounding. Grade: **satisfactory (C).**',
  skeptic:
    'I pedantically reviewed the draft:\n\n**Formal issues:**\n- Line 3: missing comma\n- Line 12: spelling issue\n- Inconsistent date formats\n\n**Logical inconsistencies:**\n- Paragraph 2 implicitly contradicts paragraph 5\n- The argument assumes X without establishing it\n\n**Internal consistency:** 7/10. Usable, but not clean.',
} as const
