CREATE   PROC [FIN].[SpGuarantyOperationDelete] 
    @GuarantyOperationID int,@Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 
BEGIN TRY
	if @Version=(Select [Version] from [FIN].[GuarantyOperation]
	where [GuarantyOperationID] = @GuarantyOperationID)
	begin	
	
		declare @CommitmentType tinyint,@OperationType tinyint,@prePrevoucherID INT,
		@ReceiveGuarantyCommitmentID int = NULL,@PaymentGuarantyCommitmentID int = NULL,
		@BankAccountID int = NULL,@GuarantyAamount decimal(30, 4),@SumDeductedAmount decimal(30, 4),
		@FinalDeductedAmount decimal(30, 4),@Number nvarchar(100) = NULL,@date date
		
		select @CommitmentType = g.CommitmentType,
			   @date = g.[date],
		       @OperationType = g.OperationType,
		       @ReceiveGuarantyCommitmentID = g.ReceiveGuarantyCommitmentID,
		       @PaymentGuarantyCommitmentID = g.PaymentGuarantyCommitmentID,
		       @BankAccountID = g.BankAccountID ,
			   @prePrevoucherID = g.PreVoucherID       
		from FIN.GuarantyOperation g
		where g.GuarantyOperationID = @GuarantyOperationID
		
		IF @prePrevoucherID IS NOT NULL
        BEGIN
            RAISERROR('UnableToDeletePrevoucher', 16, 12);
            RETURN;
        END;
		
		IF(@OperationType = 4)
		BEGIN
			
			DECLARE @MaxDate date
			SELECT @MaxDate = MAX(r.[Date]) FROM FIN.Reconciliation r WHERE r.BankAccountID = @BankAccountID  
		
			IF (@date <= @MaxDate)
			BEGIN
				
				DECLARE @Title nvarchar(256)
				
				SELECT @Title = d.Title FROM CFG.BankAccount b
				JOIN ACC.DL d on b.DlID = d.DLID
				WHERE b.BankAccountID = @BankAccountID
				
				RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
				return
			END
		END
		
		IF (@ReceiveGuarantyCommitmentID is not null)
		BEGIN
			IF EXISTS (SELECT * FROM FIN.GuarantyOperation g
			WHERE g.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID AND 
			g.GuarantyOperationID > @GuarantyOperationID)
			BEGIN
				SELECT @Number = r.Number from FIN.ReceiveGuarantyCommitment r
				WHERE r.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
				
				RAISERROR('ضمانت نامه دریافتی (%s) بعد از عملیات جاری در عملیات ضمانت نامه دیگری شرکت کرده است. به همین علت عملیات جاری قابل حذف نمی باشد.',16,12,@Number)
				RETURN
			END
		END
		
		else if (@PaymentGuarantyCommitmentID is not null)
		begin
		
			if exists (select * from FIN.GuarantyOperation g
			where g.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID and 
			g.GuarantyOperationID > @GuarantyOperationID)
			begin
				select @Number = p.Number from FIN.PaymentGuarantyCommitment p
				where p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
				
				raiserror('ضمانت نامه پرداختی (%s) بعد از عملیات جاری در عملیات ضمانت نامه دیگری شرکت کرده است. به همین علت عملیات جاری قابل حذف نمی باشد.',16,12,@Number)
				return
			end
		end
		
		if (@OperationType = 3 or @OperationType = 4)
		begin
		
			if (@CommitmentType = 1)
			begin
			
				update FIN.ReceiveGuarantyCommitment 
				set LastState = 1
				where ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
			
			end
			
			IF (@CommitmentType = 2)
			BEGIN
			
				update FIN.PaymentGuarantyCommitment
				set LastState = 1
				where PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			
			END
			
		END
		
		if (@OperationType = 4)
		begin
		
			if (@CommitmentType = 1)
			begin
			
				select @GuarantyAamount = r.Amount
				from FIN.ReceiveGuarantyCommitment r where r.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
				
				select @SumDeductedAmount = ISNULL((select SUM(g.DeductedAmount) 
				from FIN.GuarantyOperation g 
				where g.CommitmentType = 1 and 
				g.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID and
				g.OperationType = 2),0)
				
				set @FinalDeductedAmount = @GuarantyAamount - @SumDeductedAmount
				
				if LOWER((select f.ConfigValue from CFG.Configuration f
				where f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
				begin
				
					declare @LastAmount decimal(30, 4),@DlTitle nvarchar(256)
					
					SELECT @LastAmount = la.LastAmount,
						   @DlTitle = d.Title 
					FROM CFG.BankAccount ba
					JOIN ACC.DL d on ba.DlID = d.DLID
					JOIN CFG.BankAccount_LastAmount la on ba.BankAccountID = la.BankAccountID
					WHERE ba.BankAccountID = @BankAccountID
					
					if (@LastAmount < 0)
					begin
						declare @Message nvarchar(MAX)
				
						SELECT @Message = lsv.[Value]
						FROM cfg.LocalizationSQLMessage ls
						JOIN cfg.LocalizationSQLMessageValue lsv 
						ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
						WHERE ls.SQLMessageCode = 'MinusBankAccount'
						AND lsv.Culture = cfg.GetuserCulture()
						
						SET @Message = REPLACE(@Message, '{0}', @DlTitle)
						RAISERROR(@Message,16,12)
						RETURN
						--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
					end
					
				end
			
			end
			
			if (@CommitmentType = 2)
			begin
			
				select @GuarantyAamount =  p.Amount
				from FIN.PaymentGuarantyCommitment p where p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
				
				select @SumDeductedAmount = ISNULL((select SUM(g.DeductedAmount)
				from FIN.GuarantyOperation g
				where g.CommitmentType = 2 and
				g.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID and
				g.OperationType = 2),0)
				
				set @FinalDeductedAmount = @GuarantyAamount - @SumDeductedAmount
			end		
		end

		DELETE
		FROM   [FIN].[GuarantyOperation]
		WHERE  [GuarantyOperationID] = @GuarantyOperationID
	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'GuarantyOperation', -- First argument.
		@GuarantyOperationID); -- Second argument.)
	end
	
END TRY
BEGIN CATCH

	DECLARE @ErrorMessage NVARCHAR(4000);
	DECLARE @ErrorSeverity INT;
	DECLARE @ErrorState INT;

	SELECT 
		@ErrorMessage = ERROR_MESSAGE(),
		@ErrorSeverity = ERROR_SEVERITY(),
		@ErrorState = ERROR_STATE();

	if (ERROR_NUMBER()=547)
			set @ErrorState=11
	RAISERROR (@ErrorMessage, -- Message text.
			   @ErrorSeverity, -- Severity.
			   @ErrorState -- State.
			   );
		   
END CATCH
