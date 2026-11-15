
----------------------------------------------------------------------------------------------
CREATE   PROC [REQ].spStuffRequestUpdate
    @StuffRequestID INT,
    @BranchID INT,
    @StuffRequestNumber INT,
    @StuffRequestDate DATETIME,
    @StuffRequestState TINYINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
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


IF @Version <>
(
    SELECT [Version]
    FROM [REQ].[StuffRequest]
    WHERE [StuffRequestID] = @StuffRequestID
)
    RAISERROR('Version mismatch...', 16, 10);

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

    IF (EXISTS (SELECT 1
				FROM [REQ].[StuffRequest] sr
				JOIN CFG.Branch b
					ON sr.BranchID = b.BranchID
                WHERE [StuffRequestID] != @StuffRequestID
                      AND FinancialPeriodID = @FinancialPeriodID
				      AND StuffRequestNumber = @StuffRequestNumber
				      AND [Type] = @Type
					  AND b.CompanyID = @CompanyID
                      ))
    BEGIN
        SELECT @Message = N'NumberIsDuplicate';

        RAISERROR(@Message, 16, 12);
    --RAISERROR('شماره سند تکراری است', 16, 12)			
    END;

UPDATE [REQ].[StuffRequest]
SET [BranchID] = @BranchID,
    [StuffRequestNumber] = @StuffRequestNumber,
    [StuffRequestDate] = @StuffRequestDate,
    [StuffRequestState] = @StuffRequestState,
    [LastEditor] = @LastEditor,
    [LastEditionDate] = @LastEditionDate,
    [Version] = @Version + 1,
    OrganizationUnitID = @OrganizationUnitID,
    [BaseDocument] = @BaseDocument,
    [FromStockID]=@FromStockID,
    [ToStockID] = @ToStockID,
    [Type]=@Type,
    [UtilizationPlace]=@UtilizationPlace,
    [ReviewDate]=@ReviewDate,
    [Reviewer]=@Reviewer
WHERE [StuffRequestID] = @StuffRequestID
-- Begin Return Select <- do not remove
SELECT  [Version] , StuffRequestNumber
    FROM [REQ].[StuffRequest]
WHERE [StuffRequestID] = @StuffRequestID;
-- End Return Select <- do not remove
