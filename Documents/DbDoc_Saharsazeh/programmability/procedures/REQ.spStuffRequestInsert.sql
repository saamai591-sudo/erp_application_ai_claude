
----------------------------------------------------------------------
CREATE   PROC [REQ].spStuffRequestInsert
    @BranchID INT,
    @StuffRequestNumber INT,
    @StuffRequestDate DATETIME,
    @StuffRequestState TINYINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @FinancialPeriodID INT,
    @OrganizationUnitID INT,
    @BaseDocument INT,
    @FromStockID INT,
    @ToStockID INT,
    @Type TINYINT,
    @UtilizationPlace TINYINT,
    @ReviewDate DATETIME NULL,
    @Reviewer INT NULL
--WITH ENCRYPTION
AS
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE 
		@CompanyID INT,
        @Message NVARCHAR(MAX);
		
SELECT @CompanyID = CompanyID 
FROM CFG.Branch 
where BranchID = @BranchID


IF (@StuffRequestNumber = 0 OR @StuffRequestNumber IS NULL)
BEGIN
	SET @StuffRequestNumber = ISNULL((
									SELECT MAX(StuffRequestNumber) + 1
									FROM [REQ].[StuffRequest] sr
									JOIN CFG.Branch b
										ON sr.BranchID = b.BranchID
									WHERE FinancialPeriodID = @FinancialPeriodID
										AND [Type] = @Type
										AND b.CompanyID = @CompanyID
									), 1);

END;

    IF (EXISTS
    (
        SELECT 1
        FROM [REQ].[StuffRequest] sr
		JOIN CFG.Branch b
				ON sr.BranchID = b.BranchID
        WHERE FinancialPeriodID = @FinancialPeriodID
              AND StuffRequestNumber = @StuffRequestNumber
              AND [Type] = @Type
			  AND b.CompanyID = @CompanyID
    )
       )
    BEGIN
        SELECT @Message = N'NumberIsDuplicate';
        RAISERROR(@Message, 16, 12);
        RETURN;
    END;



INSERT INTO [REQ].[StuffRequest]
(
    [BranchID],
    [StuffRequestNumber],
    [StuffRequestDate],
    [StuffRequestState],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [Version],
    [FinancialPeriodID],
    [OrganizationUnitID],
    [BaseDocument],
    [FromStockID],
    [ToStockID],
    [Type],
    [UtilizationPlace],
    [ReviewDate],
    [Reviewer]
)
SELECT @BranchID,
       @StuffRequestNumber,
       @StuffRequestDate,
       @StuffRequestState,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate,
       0,
       @FinancialPeriodID,
       @OrganizationUnitID,
       @BaseDocument,
       @FromStockID,
       @ToStockID,
       @Type,
       @UtilizationPlace,
       @ReviewDate,
       @Reviewer;

-- Begin Return Select <- do not remove
SELECT [StuffRequestID],
       [Version],
       [StuffRequestNumber]
FROM [REQ].[StuffRequest]
WHERE [StuffRequestID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
