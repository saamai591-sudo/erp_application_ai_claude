

CREATE PROC [FOS].[spSpecialCostDelete] 
    @SpecialCostID int,@Version int
AS 
SET NOCOUNT ON 
BEGIN TRY 
	
	if @Version=(Select [Version] from [FOS].[SpecialCost]
	where [SpecialCostID] = @SpecialCostID)
	begin	
		
		declare @Code nvarchar(256)
		select @Code = Code from FOS.SpecialCost where SpecialCostID = @SpecialCostID

		if (@Code = '100' or @Code = '101' or @Code = '102' or @Code = '103')
		begin
			raiserror('هزینه سفارش با کد (%s) غیر قابل حذف است.',16,12,@Code)
			return
		end

		DELETE
		FROM   [FOS].[SpecialCost]
		WHERE  [SpecialCostID] = @SpecialCostID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'SpecialCost', -- First argument.
		@SpecialCostID); -- Second argument.)
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
