CREATE VIEW cfg.vwPartyAccount
AS
SELECT b.Title,
       b.Title2,
       pa.AccountNumber,
       pa.IBAN,
       pa.CardNumber,
       pa.PartyID,
       pa.PartyAccountID,
       p.DlID
FROM   cfg.PartyAccount    AS pa
JOIN cfg.Party AS p ON p.PartyID = pa.PartyID
       LEFT JOIN cfg.Bank  AS b
            ON  b.BankID = pa.BankID
