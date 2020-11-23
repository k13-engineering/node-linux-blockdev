#include <node_api.h>

#include <blkid/blkid.h>

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

namespace blockdev {

struct worker_data_in {
  int fd;
};

struct worker_data_out {
  int ret;
  char uuid[37];
  char partuuid[37];
};

struct blkid_ctx {
  struct worker_data_in data_in;
  struct worker_data_out data_out;

  napi_deferred deferred;
  napi_async_work async_work;
};

static int copy_str(const char* src, char* dst, ssize_t dst_max) {
  ssize_t res;

  res = snprintf(dst, dst_max, "%s", src);
  if(res < 0) {
    return errno;
  } else if(res >= dst_max) {
    return ENOMEM;
  }

  return 0;
}

static napi_status create_error_from_errno(napi_env env, int error_code, napi_value* error) {
  napi_value code;
  napi_value message;
  napi_status status;

  status = napi_create_string_utf8(env, "", -1, &code);
  if (status != napi_ok) return status;

  status = napi_create_string_utf8(env, strerror(error_code), -1, &message);
  if (status != napi_ok) return status;

  return napi_create_error(env, code, message, error);
};

static int copy_tag_or_empty(blkid_probe pr, const char* tag, char* output, ssize_t output_max) {
  int res;
  const char* temp;

  if(blkid_probe_has_value(pr, tag)) {
    res = blkid_probe_lookup_value(pr, tag, &temp, NULL);
    if(res != 0) {
      return errno;
    }

    return copy_str(temp, output, output_max);
  } else {
    return copy_str("", output, output_max);
  }
}

static int find_tags_of_device(int fd, char* uuid, ssize_t uuid_max, char* partuuid, ssize_t partuuid_max) {
  ssize_t res;
  blkid_probe pr;

  pr = blkid_new_probe();
  if (!pr) {
    return errno;
  }

  res = blkid_probe_set_device(pr, fd, 0, 0);
  if(res != 0) {
    goto clean;
  }

  res = blkid_do_probe(pr);
  if(res != 0) {
    res = errno;
    goto clean;
  }

  res = copy_tag_or_empty(pr, "UUID", uuid, uuid_max);
  if(res != 0) {
    goto clean;
  }

  res = copy_tag_or_empty(pr, "PARTUUID", partuuid, partuuid_max);

clean:
  blkid_free_probe(pr);

  return res;
}

static void probe_async_work(napi_env env, void* data) {
  struct blkid_ctx* ctx = (struct blkid_ctx*) data;

  ctx->data_out.ret = find_tags_of_device(ctx->data_in.fd,
                                         ctx->data_out.uuid,
                                         sizeof(ctx->data_out.uuid),
                                         ctx->data_out.partuuid,
                                         sizeof(ctx->data_out.partuuid));
}

static void probe_async_work_done(napi_env env, napi_status status, void* data) {
  struct blkid_ctx* ctx = (struct blkid_ctx*) data;
  napi_value result;
  napi_value result_uuid;
  napi_value result_partuuid;
  napi_value error;

  int ret = ctx->data_out.ret;

  if (ret == 0) {
      status = napi_create_object(env, &result);
      if (status != napi_ok) return;

      status = napi_create_string_utf8(env, ctx->data_out.uuid, NAPI_AUTO_LENGTH, &result_uuid);
      if (status != napi_ok) return;

      status = napi_create_string_utf8(env, ctx->data_out.partuuid, NAPI_AUTO_LENGTH, &result_partuuid);
      if (status != napi_ok) return;

      status = napi_set_named_property(env, result, "UUID", result_uuid);
      if (status != napi_ok) return;

      status = napi_set_named_property(env, result, "PARTUUID", result_partuuid);
      if (status != napi_ok) return;

      status = napi_resolve_deferred(env, ctx->deferred, result);
      if (status != napi_ok) return;
  }
  else {
      status = create_error_from_errno(env, ret, &error);
      if (status != napi_ok) return;

      status = napi_reject_deferred(env, ctx->deferred, error);
      if (status != napi_ok) return;
  }

  napi_delete_async_work(env, ctx->async_work);
  free(ctx);
}

static napi_value probe_native(napi_env env, napi_callback_info info) {
  napi_status status;
  napi_value resource_name;
  napi_value promise;

  napi_value args[5];
  size_t argc = sizeof(args) / sizeof(args[0]);

  int32_t fd;

  struct blkid_ctx* ctx;

  status = napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (status != napi_ok) return NULL;

  status = napi_get_value_int32(env, args[0], &fd);
  if (status != napi_ok) {
    napi_throw_type_error(env, "EINVAL", "Invalid type for fd, int32 required");
    return NULL;
  }

  ctx = (struct blkid_ctx*) malloc(sizeof(*ctx));
  ctx->data_in.fd = fd;

  status = napi_create_promise(env, &ctx->deferred, &promise);
  if (status != napi_ok) return NULL;

  status = napi_create_string_utf8(env, "blkid", -1, &resource_name);
  if (status != napi_ok) return NULL;

  status = napi_create_async_work(env, NULL, resource_name, probe_async_work, probe_async_work_done, ctx, &ctx->async_work);
  if (status != napi_ok) return NULL;

  napi_queue_async_work(env, ctx->async_work);
  if (status != napi_ok) return NULL;

  return promise;
}

napi_value init(napi_env env, napi_value exports) {
  napi_status status;

  status = napi_create_function(env, NULL, 0, probe_native, NULL, &exports);
  if (status != napi_ok) return NULL;

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)

}
