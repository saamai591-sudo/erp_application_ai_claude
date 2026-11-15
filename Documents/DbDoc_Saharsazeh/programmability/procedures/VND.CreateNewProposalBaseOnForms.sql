-------------------------------------------------------------------------------------------------

CREATE    PROCEDURE [VND].CreateNewProposalBaseOnForms
(
    @entityId INT,
    @engName NVARCHAR(255)
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @PrecisionCount INT,
            @currencyId INT = -1,
            @CultureNo TINYINT;

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = CFG.GetuserCulture();

    SELECT @PrecisionCount = c.PrecisionCount
    FROM CFG.Currency AS c
    WHERE c.CurrencyID = @currencyId;

    IF @engName = 'PurchaseRequest'
    BEGIN
        SELECT CAST(a.PurchaseRequestItemIndex AS SMALLINT) [RowIndex],
               [PurchaseRequestItemID],
               a.[StuffID],
               [MainQuantity],
               [SubQuantity],
               b.PurchaseRequestNumber RequestBaseNumber,
               c.Title StuffTitle,
               c.code StuffCode
        INTO #items
        FROM REQ.PurchaseRequestItem a
            JOIN REQ.PurchaseRequest b
                ON a.PurchaseRequestID = b.PurchaseRequestID
            JOIN STF.VWStuff c
                ON c.StuffID = a.StuffID
        WHERE a.PurchaseRequestID = @entityId;

        --Header
        SELECT sr.PurchaseRequestDate Date,
				-1000  AS ProposalID,
               sr.FinancialPeriodID,
               -1 AS CurrencyID,
               sr.BranchID,
               CAST(1 AS TINYINT) AS Status,
               CAST(2 AS TINYINT) AS BaseDocument
        FROM REQ.PurchaseRequest AS sr
        WHERE sr.PurchaseRequestID = @entityId;

        -- Items
        SELECT CAST(-1 * i.RowIndex AS INT) AS ProposalItemID,
				-1000  AS ProposalID,
               i.RequestBaseNumber,
               i.PurchaseRequestItemID,
               i.RowIndex,
               i.StuffID,
               i.StuffTitle,
               i.StuffCode,
               i.MainQuantity,
               i.SubQuantity,
               CAST(0 AS BIT) IsNotInFlow
        FROM #items AS i;

    END;
END;