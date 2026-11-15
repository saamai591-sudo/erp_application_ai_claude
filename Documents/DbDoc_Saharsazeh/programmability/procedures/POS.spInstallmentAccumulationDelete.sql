
CREATE PROC [POS].[spInstallmentAccumulationDelete] 
    @InstallmentAccumulationID int,@Version int
AS 
	SET NOCOUNT ON 

	
	if @Version=(Select [Version] from [POS].[InstallmentAccumulation]
	where [InstallmentAccumulationID] = @InstallmentAccumulationID)
	begin	



		DELETE
		FROM   [POS].[InstallmentAccumulation]
		WHERE  [InstallmentAccumulationID] = @InstallmentAccumulationID

	end
	else
	begin
	
	RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'InstallmentAccumulation', -- First argument.
		@InstallmentAccumulationID); -- Second argument.)
	end

