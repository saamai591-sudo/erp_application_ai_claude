CREATE PROCEDURE ACC.ChangeVoucherDailyNumber
(
    @VoucherId INT,
    @IsAdd BIT
)
AS
BEGIN
    DECLARE @Date DATE,
            @FinanicalPeriodId INT,
            @dailyNumber INT,
            @OtherVoucherId INT,
            @newDailyNumber INT,
            @VoucherStatus INT,
            @OtherSttausId INT,
			@companyId INT;


    SELECT @Date = v.Date,
           @FinanicalPeriodId = v.FinancialPeriodID,
           @dailyNumber = v.DailyNumber,
           @VoucherStatus = v.VoucherStatusID,
		   @companyId  = b.CompanyID
    FROM ACC.Voucher AS v
	JOIN CFG.Branch AS b ON b.BranchID = v.BranchID
    WHERE v.VoucherID = @VoucherId;


    IF @IsAdd = 1
    BEGIN
        SELECT @OtherVoucherId = v.VoucherID,
               @OtherSttausId = v.VoucherStatusID
        FROM ACC.Voucher AS v
		JOIN CFG.Branch AS b ON b.BranchID = v.BranchID
        WHERE v.Date = @Date
              AND @FinanicalPeriodId = v.FinancialPeriodID
			  AND @companyId = @companyId
              AND v.DailyNumber = @dailyNumber + 1;

        SET @newDailyNumber = @dailyNumber + 1;
    END;
    ELSE
    BEGIN
        SELECT @OtherVoucherId = v.VoucherID,
               @OtherSttausId = v.VoucherStatusID
        FROM ACC.Voucher AS v
		JOIN CFG.Branch AS b ON b.BranchID = v.BranchID
        WHERE v.Date = @Date
              AND @FinanicalPeriodId = v.FinancialPeriodID
			  AND b.CompanyID = @companyId
              AND v.DailyNumber = @dailyNumber - 1;

        SET @newDailyNumber = @dailyNumber - 1;
    END;

    IF @VoucherStatus = 4
       OR @OtherSttausId = 4
    BEGIN
        RAISERROR('مجاز به تغییر شماره روزانه این سند نمی باشید.', 16, 12);
        RETURN 0;
    END;

    IF @newDailyNumber > 0
    BEGIN
        ALTER INDEX IX_Voucher_1 ON ACC.Voucher DISABLE;

        UPDATE ACC.Voucher
        SET DailyNumber = @newDailyNumber
        WHERE VoucherID = @VoucherId;

        IF @OtherVoucherId IS NOT NULL
        BEGIN
            UPDATE ACC.Voucher
            SET DailyNumber = @dailyNumber
            WHERE VoucherID = @OtherVoucherId;
        END;

        ALTER INDEX IX_Voucher_1 ON ACC.Voucher REBUILD;
    END;
END;
