

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.2.349
 * Time: 10/4/2017 3:46:07 PM
 ************************************************************/

CREATE VIEW [APS].[FactVoucherDL]
AS 

SELECT ROW_NUMBER() OVER(ORDER BY alvi.AccountLevelVoucherItemID) AS ID,
       vi.VoucherItemID,
       alvi.AccountLevelID,
       alvi.DlID
FROM   acc.VoucherItem AS vi
       INNER JOIN ACC.AccountLevelVoucherItem AS alvi
            ON  alvi.VoucherItemID = vi.VoucherItemID
