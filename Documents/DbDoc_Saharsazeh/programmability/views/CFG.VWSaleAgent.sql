
-----------------------------------------------------------------------
CREATE   VIEW [CFG].VWSaleAgent
--WITH ENCRYPTION
AS
SELECT sa.SaleAgentID,
       p.[PartyID],
       p.Type,
       p.IdentificationCode,
       p.NationalID,
       p.EconomicCode,
       d.Code DlCode,
       d.Title DlTitle,
       d.Title2 DlTitle2,
       g.Code CommissionGroupCode,
       g.Title CommissionGroupTitle,
       g.Title2 CommissionGroupTitle2
FROM SLE.SaleAgent AS sa
    JOIN CFG.[Group] AS g
        ON g.GroupID = sa.PorcentageGroupID
    JOIN [CFG].[Party] p
        ON p.PartyID = sa.PartyID
    JOIN ACC.DL d
        ON d.DLID = p.DlID;
