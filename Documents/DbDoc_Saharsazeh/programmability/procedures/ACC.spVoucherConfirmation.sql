CREATE PROC [ACC].[spVoucherConfirmation] 
    @FinancialPeriodID INT,
    @ToNumber INT,
    @LatestConfirmVoucherDate DATETIME = NULL,
    @ToDate DATETIME,
    @CompanyId INT

--WITH ENCRYPTION 
AS
BEGIN

    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRAN;


    DECLARE @count INT,
            @UserId INT;
    --set @count =0

    SET @UserId = CFG.GetuserID();

    SELECT @count = COUNT(*)
    FROM [ACC].[Voucher] v
        JOIN CFG.Branch AS b
            ON b.BranchID = v.BranchID
    WHERE v.FinancialPeriodID = @FinancialPeriodId
          AND b.CompanyID = @CompanyId
          AND
          (
              @LatestConfirmVoucherDate IS NULL
              OR v.Date >= @LatestConfirmVoucherDate
          )
          AND
          (
              @ToDate IS NULL
              OR v.Date <= @ToDate
          )
          AND
          (
              @ToNumber IS NULL
              OR v.Number <= @ToNumber
          )
          AND v.VoucherStatusID IN ( 1, 2 );

    IF (@count = 0)
    BEGIN

        DECLARE @ConfirmStatusID INT = 4,
                @SurveyStatusID INT = 3,
                @SurveyVoucherCount INT;

        SELECT @SurveyVoucherCount = COUNT(*)
        FROM ACC.Voucher v
            JOIN CFG.Branch AS b
                ON b.BranchID = v.BranchID
        WHERE v.FinancialPeriodID = @FinancialPeriodId
              AND b.CompanyID = @CompanyId
              AND v.VoucherStatusID = @SurveyStatusID
              AND
              (
                  @LatestConfirmVoucherDate IS NULL
                  OR v.Date >= @LatestConfirmVoucherDate
              )
              AND
              (
                  @ToDate IS NULL
                  OR v.Date <= @ToDate
              )
              AND
              (
                  @ToNumber IS NULL
                  OR v.Number <= @ToNumber
              );


        IF (@SurveyVoucherCount != 0)
        BEGIN

            EXEC [ACC].[spResetVoucherNumbers] @FinancialPeriodID = @FinancialPeriodID,
                                               @CompanyId = @CompanyId;

            UPDATE v
            SET v.VoucherStatusID = @ConfirmStatusID,
                v.Corroborator = @UserId
            FROM [ACC].[Voucher] v
                JOIN CFG.Branch b
                    ON b.BranchID = v.BranchID
            WHERE v.FinancialPeriodID = @FinancialPeriodID
                  AND b.CompanyID = @CompanyId
                  AND
                  (
                      @LatestConfirmVoucherDate IS NULL
                      OR v.Date >= @LatestConfirmVoucherDate
                  )
                  AND
                  (
                      @ToDate IS NULL
                      OR v.Date <= @ToDate
                  )
                  AND
                  (
                      @ToNumber IS NULL
                      OR v.Number <= @ToNumber
                  );
        END;


    END;
    ELSE IF (@count > 0)
    BEGIN

        RAISERROR('ACC_spVoucherConfirmation', 16, 12);
    END;
    SELECT 0;
    COMMIT;

END;
