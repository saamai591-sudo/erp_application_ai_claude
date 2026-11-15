CREATE   PROCEDURE [ACC].[MatchVoucherItems]
(
    @firstVoucherItemId INT = 1061743173,
    @secoundVoucherItemId INT = 1061743175
)
AS
BEGIN


    SELECT vi.VoucherItemID,
           vi.Debit,
           vi.Credit,
           vvar.Remain
    INTO #vouchers
    FROM ACC.VoucherItem AS vi
        JOIN ACC.vwVoucherAnalyzeRemain AS vvar
            ON vvar.VoucherItemID = vi.VoucherItemID
    WHERE vi.VoucherItemID IN ( @firstVoucherItemId, @secoundVoucherItemId );


    IF
    (
        SELECT COUNT(1) FROM #vouchers AS v WHERE v.Credit > 0
    ) > 1
    OR
    (
        SELECT COUNT(1) FROM #vouchers AS v WHERE v.Debit > 0
    ) > 1
    BEGIN
        RAISERROR('Accounting.CannotMatchRecords', 16, 12);
        RETURN;
    END;


    IF EXISTS (SELECT 1 FROM #vouchers AS v WHERE v.Remain = 0)
    BEGIN
        RAISERROR('Accounting.SomeRecordsAnalyzedCompletely', 16, 12);
        RETURN;
    END;

    DECLARE @userId INT = CFG.GetuserID();


    INSERT INTO ACC.VoucherAnalyze
    (
        DebitVoucherItemID,
        CreditVoucherItemID,
        Amount,
        LastEditor,
        Creator,
        CreationDate,
        Version,
        LastEditionDate
    )
    VALUES
    (
        (
            SELECT TOP (1)
                   v.VoucherItemID
            FROM #vouchers AS v
            WHERE v.Debit > 0
            ORDER BY v.VoucherItemID
        ),         -- DebitVoucherItemID - int
        (
            SELECT TOP (1)
                   v.VoucherItemID
            FROM #vouchers AS v
            WHERE v.Credit > 0
            ORDER BY v.VoucherItemID
        ),         -- CreditVoucherItemID - int
        (
            SELECT TOP (1)
                   MIN(v2.Remain)
            FROM #vouchers AS v2
            ORDER BY MIN(v2.Remain)
        ),         -- Amount - decimal(30, 4)
        @userId,   -- LastEditor - int
        @userId,   -- Creator - int
        GETDATE(), -- CreationDate - datetime
        0,         -- Version - int
        GETDATE()  -- LastEditionDate - datetime
        );

END;
