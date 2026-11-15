
CREATE   PROCEDURE [AST].DeleteDepreciationVoucher
(
    @DepreciationCalculationID INT
)

--WITH ENCRYPTION 
AS
    DECLARE @Message               NVARCHAR(MAX),
            @BranchID              INT,
            @VoucherID             INT,
            @FinancialPeriodID     INT,
            @DestructionID         INT,
            @SalvageID             INT,
            @SaleID                INT,
            @TransferID            INT,
            @ChangeCategoryID      INT;
    
    
      --set @DestructionID = CASE WHEN @Document = 'Destruction' then @DocumentID else Null end   
	     --   set @SalvageID =     CASE WHEN @Document = 'Salvage' then @DocumentID else Null end    
	     --   set @SaleID =     CASE WHEN @Document = 'Sale' then @DocumentID else Null end    
	     --   set @TransferID =     CASE WHEN @Document = 'Transfer' then @DocumentID else Null end    
	     --   set @ChangeCategoryID =     CASE WHEN @Document = 'ChangeCategory' then @DocumentID else Null end   
	            

     
     SELECT @BranchID = dc.BranchID,
            @VoucherID = dc.VoucherID,
            @FinancialPeriodID = dp.FinancialPeriodID
     FROM   ast.DepreciationCalculation  AS dc
            JOIN ast.DepreciationPeriod  AS dp
                 ON  dp.DepreciationPeriodID = dc.DepreciationPeriodID
     WHERE  dc.DepreciationCalculationID = @DepreciationCalculationID

    IF EXISTS (   SELECT 1
                  FROM   AST.AssetClosingOperation a
                  WHERE a.BranchID = @BranchID
                  and a.FinancialPeriodID = @FinancialPeriodID
						)
        BEGIN
			--drop table #ttemp
            SET @Message =  'E_AssetManager.AssetManagerIsClosed';
            RAISERROR(@Message, 16, 12);
            RETURN;

        END;

		DECLARE @voucherIds NVARCHAR(MAX)
		
    SELECT @voucherIds = CAST (@VoucherID as NVARCHAR(250))

	BEGIN TRY

		EXEC ACC.ValidateVouchers @voucherIDs = @voucherIds,	-- nvarchar(max)
			 @currentFinancialPeriodID = @FinancialPeriodID,	-- int
			 @isDelete = 1,	-- bit
			 @voucherItemIds = DEFAULT -- nvarchar(max)
	          
	END TRY
	BEGIN CATCH
		DECLARE @ErrorMessage NVARCHAR(4000);
		DECLARE @ErrorSeverity INT;
		DECLARE @ErrorState INT;

		SELECT @ErrorMessage = ERROR_MESSAGE(),
			   @ErrorSeverity = ERROR_SEVERITY(),
			   @ErrorState = ERROR_STATE();


		RAISERROR(   @ErrorMessage,  -- Message text.
					 @ErrorSeverity, -- Severity.
					 @ErrorState     -- State.
				 );
		RETURN;
	END CATCH;


    IF EXISTS (   SELECT v.VoucherID
                  FROM   ACC.Voucher v 
                  WHERE  v.VoucherID = @VoucherID and   v.VoucherStatusID IN ( 3, 4 ))
        BEGIN

            SET @Message =  'E_Accounting.SomeVouchers';
            RAISERROR(@Message, 16, 12);
            RETURN;

        END;
    ELSE
    Begin

        Update AST.DepreciationCalculation
        set VoucherID = NULL
        where DepreciationCalculationID = @DepreciationCalculationID

        DELETE ACC.Voucher
        WHERE VoucherID =@VoucherID;

    End
